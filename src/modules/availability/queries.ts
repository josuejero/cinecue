import { getDb } from "@/db/client";
import { availabilityChangeEvents, movieLocalStatuses, movies, userMovieFollows } from "@/db/schema";
import type { MovieAvailabilityStatus } from "@/modules/availability/read-model";
import { resolvePosterUrl } from "@/modules/catalog/posters";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

const STATUS_ORDER: MovieAvailabilityStatus[] = [
  "now_playing",
  "advance_tickets",
  "coming_soon",
  "no_local_schedule_yet",
  "stopped_playing",
];

const STATUS_LABELS: Record<MovieAvailabilityStatus, string> = {
  now_playing: "Now playing",
  advance_tickets: "Advance tickets",
  coming_soon: "Coming soon",
  no_local_schedule_yet: "No local schedule yet",
  stopped_playing: "Stopped playing",
};

export async function loadDashboard(userId: string, locationId: string) {
  const db = getDb();

  const rows = await db
    .select({
      movieId: movies.id,
      title: movies.canonicalTitle,
      releaseYear: movies.releaseYear,
      releaseDate: movies.releaseDate,
      posterUrl: movies.posterUrl,
      shortDescription: movies.shortDescription,
      followedAt: userMovieFollows.createdAt,
      status: movieLocalStatuses.status,
      nextShowingAt: movieLocalStatuses.nextShowingAt,
      firstShowingAt: movieLocalStatuses.firstShowingAt,
      lastShowingAt: movieLocalStatuses.lastShowingAt,
      theatreCount: movieLocalStatuses.theatreCount,
      statusChangedAt: movieLocalStatuses.statusChangedAt,
    })
    .from(userMovieFollows)
    .innerJoin(movies, eq(userMovieFollows.movieId, movies.id))
    .leftJoin(
      movieLocalStatuses,
      and(
        eq(movieLocalStatuses.movieId, userMovieFollows.movieId),
        eq(movieLocalStatuses.locationId, userMovieFollows.locationId),
      ),
    )
    .where(
      and(
        eq(userMovieFollows.userId, userId),
        eq(userMovieFollows.locationId, locationId),
      ),
    )
    .orderBy(desc(movieLocalStatuses.nextShowingAt), asc(movies.canonicalTitle));

  const grouped = new Map<
    MovieAvailabilityStatus,
    Array<{
      movieId: string;
      title: string;
      releaseYear: number | null;
      releaseDate: string | null;
      posterUrl: string | null;
      shortDescription: string | null;
      followedAt: Date;
      nextShowingAt: Date | null;
      firstShowingAt: Date | null;
      lastShowingAt: Date | null;
      theatreCount: number;
      statusChangedAt: Date | null;
    }>
  >();

  for (const status of STATUS_ORDER) {
    grouped.set(status, []);
  }

  for (const row of rows) {
    const status = (row.status ?? "no_local_schedule_yet") as MovieAvailabilityStatus;
    grouped.get(status)?.push({
      movieId: row.movieId,
      title: row.title,
      releaseYear: row.releaseYear ?? null,
      releaseDate: row.releaseDate ?? null,
      posterUrl: resolvePosterUrl(row.posterUrl ?? null),
      shortDescription: row.shortDescription ?? null,
      followedAt: row.followedAt,
      nextShowingAt: row.nextShowingAt ?? null,
      firstShowingAt: row.firstShowingAt ?? null,
      lastShowingAt: row.lastShowingAt ?? null,
      theatreCount: row.theatreCount ?? 0,
      statusChangedAt: row.statusChangedAt ?? null,
    });
  }

  return {
    totalFollows: rows.length,
    sections: STATUS_ORDER.map((status) => ({
      status,
      label: STATUS_LABELS[status],
      items: grouped.get(status) ?? [],
    })),
  };
}

export async function listAvailabilityChanges(input: {
  userId: string;
  locationId: string;
  limit?: number;
}) {
  const db = getDb();
  const limit = Math.max(1, Math.min(input.limit ?? 20, 100));

  const rows = await db
    .select({
      id: availabilityChangeEvents.id,
      eventKind: availabilityChangeEvents.eventKind,
      changedAt: availabilityChangeEvents.changedAt,
      previousStatus: availabilityChangeEvents.previousStatus,
      newStatus: availabilityChangeEvents.newStatus,
      previousTheatreCount: availabilityChangeEvents.previousTheatreCount,
      newTheatreCount: availabilityChangeEvents.newTheatreCount,
      previousNextShowingAt: availabilityChangeEvents.previousNextShowingAt,
      newNextShowingAt: availabilityChangeEvents.newNextShowingAt,
      movieId: movies.id,
      title: movies.canonicalTitle,
      posterUrl: movies.posterUrl,
    })
    .from(availabilityChangeEvents)
    .innerJoin(movies, eq(availabilityChangeEvents.movieId, movies.id))
    .innerJoin(
      userMovieFollows,
      and(
        eq(userMovieFollows.movieId, availabilityChangeEvents.movieId),
        eq(userMovieFollows.locationId, availabilityChangeEvents.locationId),
        eq(userMovieFollows.userId, input.userId),
      ),
    )
    .where(
      and(
        eq(availabilityChangeEvents.locationId, input.locationId),
        inArray(availabilityChangeEvents.eventKind, [
          "status_changed",
          "newly_scheduled",
          "now_playing",
          "advance_tickets",
          "stopped_playing",
        ]),
      ),
    )
    .orderBy(desc(availabilityChangeEvents.changedAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    posterUrl: resolvePosterUrl(row.posterUrl ?? null),
  }));
}
