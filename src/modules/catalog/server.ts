import { and, asc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  movieLocalStatuses,
  movies,
  showtimes,
  theatres,
  userMovieFollows,
} from "@/db/schema";
import { resolvePosterUrl } from "@/modules/catalog/posters";
import { NotFoundError } from "@/shared/http/errors";

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
