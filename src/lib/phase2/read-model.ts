import { getDb } from "@/db/client";
import {
  availabilityChangeEvents,
  locations,
  movieLocalStatuses,
  movies,
  showtimes,
  userMovieFollows,
} from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import crypto from "node:crypto";
import { NotFoundError } from "./errors";

function createId() {
  return crypto.randomUUID();
}

export type MovieAvailabilityStatus =
  | "now_playing"
  | "advance_tickets"
  | "coming_soon"
  | "no_local_schedule_yet"
  | "stopped_playing";

type DerivationShowtime = {
  theatreId: string;
  businessDate: string;
  startAtLocal: Date;
  isAdvanceTicket: boolean;
};

export type DerivedMovieLocalState = {
  status: MovieAvailabilityStatus;
  nextShowingAt: Date | null;
  firstShowingAt: Date | null;
  lastShowingAt: Date | null;
  theatreCount: number;
};

function sameTimestamp(left?: Date | null, right?: Date | null) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.getTime() === right.getTime();
}

export function deriveMovieLocalState(input: {
  currentBusinessDate: string;
  releaseDate?: string | null;
  showings: DerivationShowtime[];
}): DerivedMovieLocalState {
  const sorted = [...input.showings].sort(
    (left, right) => left.startAtLocal.getTime() - right.startAtLocal.getTime(),
  );

  const upcoming = sorted.filter(
    (showing) => showing.businessDate >= input.currentBusinessDate,
  );

  const hasNowPlaying = upcoming.some(
    (showing) => showing.businessDate <= input.currentBusinessDate,
  );

  const nextShowingAt = upcoming[0]?.startAtLocal ?? null;
  const firstShowingAt = sorted[0]?.startAtLocal ?? null;
  const lastShowingAt = sorted[sorted.length - 1]?.startAtLocal ?? null;
  const theatreCount = new Set(upcoming.map((showing) => showing.theatreId)).size;

  let status: MovieAvailabilityStatus;

  if (hasNowPlaying) {
    status = "now_playing";
  } else if (upcoming.length > 0) {
    status = "advance_tickets";
  } else if (!sorted.length && input.releaseDate && input.releaseDate > input.currentBusinessDate) {
    status = "coming_soon";
  } else if (sorted.length > 0) {
    status = "stopped_playing";
  } else {
    status = "no_local_schedule_yet";
  }

  return {
    status,
    nextShowingAt,
    firstShowingAt,
    lastShowingAt,
    theatreCount,
  };
}

export async function refreshMovieLocalStatusForLocation(
  locationId: string,
  movieId: string,
) {
  const db = getDb();
  const currentBusinessDate = new Date().toISOString().slice(0, 10);

  const [movie] = await db
    .select({
      id: movies.id,
      releaseDate: movies.releaseDate,
    })
    .from(movies)
    .where(eq(movies.id, movieId))
    .limit(1);

  if (!movie) {
    throw new NotFoundError("Movie not found.");
  }

  const movieShowings = await db
    .select({
      theatreId: showtimes.theatreId,
      businessDate: showtimes.businessDate,
      startAtLocal: showtimes.startAtLocal,
      isAdvanceTicket: showtimes.isAdvanceTicket,
    })
    .from(showtimes)
    .where(and(eq(showtimes.locationId, locationId), eq(showtimes.movieId, movieId)))
    .orderBy(asc(showtimes.startAtLocal));

  const derived = deriveMovieLocalState({
    currentBusinessDate,
    releaseDate: movie.releaseDate ?? null,
    showings: movieShowings,
  });

  const [previous] = await db
    .select({
      status: movieLocalStatuses.status,
      theatreCount: movieLocalStatuses.theatreCount,
      nextShowingAt: movieLocalStatuses.nextShowingAt,
      statusChangedAt: movieLocalStatuses.statusChangedAt,
    })
    .from(movieLocalStatuses)
    .where(
      and(
        eq(movieLocalStatuses.locationId, locationId),
        eq(movieLocalStatuses.movieId, movieId),
      ),
    )
    .limit(1);

  const statusChanged = previous?.status !== derived.status;
  const meaningfulChange =
    !!previous &&
    (statusChanged ||
      previous.theatreCount !== derived.theatreCount ||
      !sameTimestamp(previous.nextShowingAt, derived.nextShowingAt));

  if (meaningfulChange) {
    await db.insert(availabilityChangeEvents).values({
      id: createId(),
      movieId,
      locationId,
      previousStatus: previous?.status ?? null,
      newStatus: derived.status,
      previousTheatreCount: previous?.theatreCount ?? null,
      newTheatreCount: derived.theatreCount,
      previousNextShowingAt: previous?.nextShowingAt ?? null,
      newNextShowingAt: derived.nextShowingAt,
      changedAt: new Date(),
    });
  }

  await db
    .insert(movieLocalStatuses)
    .values({
      movieId,
      locationId,
      status: derived.status,
      nextShowingAt: derived.nextShowingAt,
      firstShowingAt: derived.firstShowingAt,
      lastShowingAt: derived.lastShowingAt,
      theatreCount: derived.theatreCount,
      lastSeenInProviderAt: new Date(),
      statusChangedAt: statusChanged
        ? new Date()
        : previous?.statusChangedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [movieLocalStatuses.movieId, movieLocalStatuses.locationId],
      set: {
        status: derived.status,
        nextShowingAt: derived.nextShowingAt,
        firstShowingAt: derived.firstShowingAt,
        lastShowingAt: derived.lastShowingAt,
        theatreCount: derived.theatreCount,
        lastSeenInProviderAt: new Date(),
        statusChangedAt: statusChanged
          ? new Date()
          : previous?.statusChangedAt ?? new Date(),
        updatedAt: new Date(),
      },
    });

  return derived;
}

export async function refreshSelectedMovieLocalStatuses(
  locationId: string,
  movieIds: string[],
) {
  const uniqueMovieIds = [...new Set(movieIds.filter(Boolean))];

  for (const movieId of uniqueMovieIds) {
    await refreshMovieLocalStatusForLocation(locationId, movieId);
  }

  return uniqueMovieIds.length;
}

export async function refreshLocationReadModel(locationId: string) {
  const db = getDb();

  const showtimeMovieRows = await db
    .selectDistinct({ movieId: showtimes.movieId })
    .from(showtimes)
    .where(eq(showtimes.locationId, locationId));

  const followedMovieRows = await db
    .selectDistinct({ movieId: userMovieFollows.movieId })
    .from(userMovieFollows)
    .where(eq(userMovieFollows.locationId, locationId));

  const movieIds = [
    ...new Set([
      ...showtimeMovieRows.map((row) => row.movieId),
      ...followedMovieRows.map((row) => row.movieId),
    ]),
  ];

  await refreshSelectedMovieLocalStatuses(locationId, movieIds);

  return {
    locationId,
    processedMovies: movieIds.length,
  };
}

export async function refreshLocationReadModelByNormalizedKey(normalizedKey: string) {
  const db = getDb();

  const [location] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.normalizedKey, normalizedKey))
    .limit(1);

  if (!location) {
    return {
      locationId: null,
      processedMovies: 0,
    };
  }

  return refreshLocationReadModel(location.id);
}