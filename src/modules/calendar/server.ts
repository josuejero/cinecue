import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { movies, showtimes, theatres } from "@/db/schema";
import { getServerEnv } from "@/shared/infra/env";

type CalendarRow = {
  showtimeId: string;
  movieId: string;
  title: string;
  runtimeMinutes: number | null;
  theatreId: string;
  theatreName: string;
  theatreAddress1: string | null;
  theatreCity: string | null;
  theatreState: string | null;
  theatreTimeZone: string | null;
  startAtLocal: Date | string;
};

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcsLine(value: string) {
  if (value.length <= 75) {
    return value;
  }

  const chunks: string[] = [];

  for (let index = 0; index < value.length; index += 75) {
    const chunk = value.slice(index, index + 75);
    chunks.push(index === 0 ? chunk : ` ${chunk}`);
  }

  return chunks.join("\r\n");
}

function toUtcStamp(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function getLocalParts(value: Date | string) {
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);

    if (match) {
      return {
        year: match[1],
        month: match[2],
        day: match[3],
        hour: match[4],
        minute: match[5],
        second: match[6] ?? "00",
      };
    }
  }

  const date = typeof value === "string" ? new Date(value) : value;

  return {
    year: String(date.getFullYear()).padStart(4, "0"),
    month: String(date.getMonth() + 1).padStart(2, "0"),
    day: String(date.getDate()).padStart(2, "0"),
    hour: String(date.getHours()).padStart(2, "0"),
    minute: String(date.getMinutes()).padStart(2, "0"),
    second: String(date.getSeconds()).padStart(2, "0"),
  };
}

function toIcsLocal(value: Date | string) {
  const parts = getLocalParts(value);
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

function addMinutesPreservingLocalTime(value: Date | string, minutes: number) {
  const parts = getLocalParts(value);
  const iso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  const date = new Date(iso);
  return new Date(date.getTime() + minutes * 60_000);
}

export async function listUpcomingShowingsForMovieAndLocation(input: {
  movieId: string;
  locationId: string;
  limit?: number;
}) {
  const db = getDb();

  return db
    .select({
      showtimeId: showtimes.id,
      movieId: movies.id,
      title: movies.canonicalTitle,
      runtimeMinutes: movies.runtimeMinutes,
      theatreId: theatres.id,
      theatreName: theatres.name,
      theatreAddress1: theatres.address1,
      theatreCity: theatres.city,
      theatreState: theatres.state,
      theatreTimeZone: theatres.timeZone,
      startAtLocal: showtimes.startAtLocal,
    })
    .from(showtimes)
    .innerJoin(movies, eq(showtimes.movieId, movies.id))
    .innerJoin(theatres, eq(showtimes.theatreId, theatres.id))
    .where(
      and(
        eq(showtimes.movieId, input.movieId),
        eq(showtimes.locationId, input.locationId),
        sql`${showtimes.startAtLocal} >= localtimestamp`,
      ),
    )
    .orderBy(asc(showtimes.startAtLocal))
    .limit(input.limit ?? 25);
}

export function buildCalendarFile(rows: CalendarRow[]) {
  const env = getServerEnv();
  const dtStamp = toUtcStamp(new Date());

  const events = rows.map((row) => {
    const durationMinutes =
      row.runtimeMinutes ?? env.CALENDAR_DEFAULT_DURATION_MINUTES;
    const endAtLocal = addMinutesPreservingLocalTime(row.startAtLocal, durationMinutes);
    const tzid = row.theatreTimeZone || "America/New_York";
    const location = [
      row.theatreName,
      row.theatreAddress1,
      row.theatreCity,
      row.theatreState,
    ]
      .filter(Boolean)
      .join(", ");

    return [
      "BEGIN:VEVENT",
      `UID:${row.movieId}-${row.showtimeId}@cinecue`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;TZID=${tzid}:${toIcsLocal(row.startAtLocal)}`,
      `DTEND;TZID=${tzid}:${toIcsLocal(endAtLocal)}`,
      `SUMMARY:${escapeIcsText(row.title)}`,
      `LOCATION:${escapeIcsText(location)}`,
      `DESCRIPTION:${escapeIcsText(`CineCue showing at ${row.theatreName}`)}`,
      "END:VEVENT",
    ]
      .map(foldIcsLine)
      .join("\r\n");
  });

  return [
    foldIcsLine("BEGIN:VCALENDAR"),
    foldIcsLine("VERSION:2.0"),
    foldIcsLine("PRODID:-//CineCue//Movie Availability//EN"),
    foldIcsLine("CALSCALE:GREGORIAN"),
    foldIcsLine("METHOD:PUBLISH"),
    ...events,
    foldIcsLine("END:VCALENDAR"),
    "",
  ].join("\r\n");
}
