import { getDb } from "@/db/client";
import {
  availabilityChangeEvents,
  movieLocalStatuses,
  movies,
  showtimes,
  theatres,
  userMovieFollows,
} from "@/db/schema";
import { normalizeTitle } from "@/lib/normalize";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { NotFoundError } from "./errors";
import { resolvePosterUrl } from "@/lib/media-cloud";
import type { MovieAvailabilityStatus } from "./read-model";

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

export async function getFollowedMovieIds(userId: string, locationId: string) {
  const db = getDb();

  const rows = await db
    .select({ movieId: userMovieFollows.movieId })
    .from(userMovieFollows)
    .where(
      and(
        eq(userMovieFollows.userId, userId),
        eq(userMovieFollows.locationId, locationId),
      ),
    );

  return rows.map((row) => row.movieId);
}

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

export async function searchMoviesForFollowFlow(input: {
  userId: string;
  locationId: string;
  query: string;
  limit?: number;
}) {
  const db = getDb();
  const normalizedQuery = normalizeTitle(input.query);
  const limit = Math.max(1, Math.min(input.limit ?? 20, 50));

  if (normalizedQuery.length < 2) {
    return [];
  }

  const containsValue = `%${normalizedQuery}%`;
  const startsWithValue = `${normalizedQuery}%`;

  const rankSql = sql<number>`
    case
      when ${movies.normalizedTitle} = ${normalizedQuery} then 300
      when ${movies.normalizedTitle} like ${startsWithValue} then 200
      else 100
    end
  `;

  const rows = await db
    .select({
      movieId: movies.id,
      title: movies.canonicalTitle,
      normalizedTitle: movies.normalizedTitle,
      releaseYear: movies.releaseYear,
      releaseDate: movies.releaseDate,
      posterUrl: movies.posterUrl,
      shortDescription: movies.shortDescription,
      rank: rankSql,
    })
    .from(movies)
    .where(sql`${movies.normalizedTitle} like ${containsValue}`)
    .orderBy(desc(rankSql), desc(movies.releaseYear), asc(movies.canonicalTitle))
    .limit(limit);

  if (!rows.length) {
    return [];
  }

  const followedRows = await db
    .select({ movieId: userMovieFollows.movieId })
    .from(userMovieFollows)
    .where(
      and(
        eq(userMovieFollows.userId, input.userId),
        eq(userMovieFollows.locationId, input.locationId),
        inArray(
          userMovieFollows.movieId,
          rows.map((row) => row.movieId),
        ),
      ),
    );

  const followedSet = new Set(followedRows.map((row) => row.movieId));

  return rows.map((row) => ({
    movieId: row.movieId,
    title: row.title,
    releaseYear: row.releaseYear ?? null,
    releaseDate: row.releaseDate ?? null,
    posterUrl: resolvePosterUrl(row.posterUrl ?? null),
    shortDescription: row.shortDescription ?? null,
    isFollowed: followedSet.has(row.movieId),
  }));
}

export async function loadMovieDetail(input: {
  userId: string;
  locationId: string;
  movieId: string;
}) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const [movie] = await db
    .select({
      movieId: movies.id,
      title: movies.canonicalTitle,
      releaseYear: movies.releaseYear,
      releaseDate: movies.releaseDate,
      entityType: movies.entityType,
      subType: movies.subType,
      shortDescription: movies.shortDescription,
      longDescription: movies.longDescription,
      runtimeMinutes: movies.runtimeMinutes,
      posterUrl: movies.posterUrl,
    })
    .from(movies)
    .where(eq(movies.id, input.movieId))
    .limit(1);

  if (!movie) {
    throw new NotFoundError("Movie not found.");
  }
  const normalizedPosterUrl = resolvePosterUrl(movie.posterUrl ?? null);

  const [status] = await db
    .select({
      status: movieLocalStatuses.status,
      nextShowingAt: movieLocalStatuses.nextShowingAt,
      firstShowingAt: movieLocalStatuses.firstShowingAt,
      lastShowingAt: movieLocalStatuses.lastShowingAt,
      theatreCount: movieLocalStatuses.theatreCount,
      statusChangedAt: movieLocalStatuses.statusChangedAt,
    })
    .from(movieLocalStatuses)
    .where(
      and(
        eq(movieLocalStatuses.movieId, input.movieId),
        eq(movieLocalStatuses.locationId, input.locationId),
      ),
    )
    .limit(1);

  const [follow] = await db
    .select({ id: userMovieFollows.id })
    .from(userMovieFollows)
    .where(
      and(
        eq(userMovieFollows.userId, input.userId),
        eq(userMovieFollows.locationId, input.locationId),
        eq(userMovieFollows.movieId, input.movieId),
      ),
    )
    .limit(1);

  const showRows = await db
    .select({
      showtimeId: showtimes.id,
      startAtLocal: showtimes.startAtLocal,
      businessDate: showtimes.businessDate,
      qualities: showtimes.qualities,
      ticketUrl: showtimes.ticketUrl,
      isAdvanceTicket: showtimes.isAdvanceTicket,
      theatreId: theatres.id,
      theatreName: theatres.name,
      theatreAddress1: theatres.address1,
      theatreCity: theatres.city,
      theatreState: theatres.state,
      theatrePostalCode: theatres.postalCode,
    })
    .from(showtimes)
    .innerJoin(theatres, eq(showtimes.theatreId, theatres.id))
    .where(
      and(
        eq(showtimes.locationId, input.locationId),
        eq(showtimes.movieId, input.movieId),
        gte(showtimes.businessDate, today),
      ),
    )
    .orderBy(asc(showtimes.startAtLocal))
    .limit(30);

  const theatresMap = new Map<
    string,
    {
      theatreId: string;
      name: string;
      address1: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
      nextShowingAt: Date | null;
      upcomingShowtimeCount: number;
    }
  >();

  for (const row of showRows) {
    const existing = theatresMap.get(row.theatreId);

    if (existing) {
      existing.upcomingShowtimeCount += 1;
      if (!existing.nextShowingAt || existing.nextShowingAt > row.startAtLocal) {
        existing.nextShowingAt = row.startAtLocal;
      }
      continue;
    }

    theatresMap.set(row.theatreId, {
      theatreId: row.theatreId,
      name: row.theatreName,
      address1: row.theatreAddress1 ?? null,
      city: row.theatreCity ?? null,
      state: row.theatreState ?? null,
      postalCode: row.theatrePostalCode ?? null,
      nextShowingAt: row.startAtLocal,
      upcomingShowtimeCount: 1,
    });
  }

  return {
    movie: {
      ...movie,
      posterUrl: normalizedPosterUrl,
      isFollowed: Boolean(follow),
      localStatus: status
        ? {
            status: status.status,
            nextShowingAt: status.nextShowingAt ?? null,
            firstShowingAt: status.firstShowingAt ?? null,
            lastShowingAt: status.lastShowingAt ?? null,
            theatreCount: status.theatreCount,
            statusChangedAt: status.statusChangedAt ?? null,
          }
        : null,
      nextShowings: showRows.map((row) => ({
        showtimeId: row.showtimeId,
        startAtLocal: row.startAtLocal,
        businessDate: row.businessDate,
        qualities: row.qualities ?? null,
        ticketUrl: row.ticketUrl ?? null,
        isAdvanceTicket: row.isAdvanceTicket,
        theatre: {
          theatreId: row.theatreId,
          name: row.theatreName,
          address1: row.theatreAddress1 ?? null,
          city: row.theatreCity ?? null,
          state: row.theatreState ?? null,
          postalCode: row.theatrePostalCode ?? null,
        },
      })),
      nearbyTheatres: [...theatresMap.values()],
    },
  };
}

export async function listNearbyTheatresForLocation(locationId: string) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const nextShowingSql = sql<Date | null>`min(${showtimes.startAtLocal})`;
  const activeMovieCountSql = sql<number>`count(distinct ${showtimes.movieId})`;
  const upcomingShowtimeCountSql = sql<number>`count(*)`;

  const rows = await db
    .select({
      theatreId: theatres.id,
      name: theatres.name,
      address1: theatres.address1,
      city: theatres.city,
      state: theatres.state,
      postalCode: theatres.postalCode,
      nextShowingAt: nextShowingSql,
      activeMovieCount: activeMovieCountSql,
      upcomingShowtimeCount: upcomingShowtimeCountSql,
    })
    .from(showtimes)
    .innerJoin(theatres, eq(showtimes.theatreId, theatres.id))
    .where(and(eq(showtimes.locationId, locationId), gte(showtimes.businessDate, today)))
    .groupBy(
      theatres.id,
      theatres.name,
      theatres.address1,
      theatres.city,
      theatres.state,
      theatres.postalCode,
    )
    .orderBy(asc(theatres.name));

  return rows.map((row) => ({
    theatreId: row.theatreId,
    name: row.name,
    address1: row.address1 ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    postalCode: row.postalCode ?? null,
    nextShowingAt: row.nextShowingAt ?? null,
    activeMovieCount: Number(row.activeMovieCount),
    upcomingShowtimeCount: Number(row.upcomingShowtimeCount),
  }));
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
