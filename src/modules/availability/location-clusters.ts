import { getDb } from "@/db/client";
import { locationSyncStates, locations, userMovieFollows, userSavedLocations } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";

export type ActiveLocationCluster = {
  locationId: string;
  normalizedKey: string;
  postalCode: string | null;
  label: string | null;
  radiusMiles: number;
  activeUserCount: number;
  followedMovieCount: number;
  lastSuccessfulSyncAt: Date | null;
  staleAfterSeconds: number;
};

export async function listActiveLocationClusters(limit = 100): Promise<ActiveLocationCluster[]> {
  const db = getDb();

  const rows = await db
    .select({
      locationId: locations.id,
      normalizedKey: locations.normalizedKey,
      postalCode: locations.postalCode,
      label: locations.label,
      radiusMiles: locations.radiusMiles,
      activeUserCount: sql<number>`count(distinct ${userSavedLocations.userId})`.mapWith(Number),
      followedMovieCount: sql<number>`count(distinct ${userMovieFollows.movieId})`.mapWith(Number),
      lastSuccessfulSyncAt: locationSyncStates.lastSuccessfulSyncAt,
      staleAfterSeconds: sql<number>`coalesce(${locationSyncStates.staleAfterSeconds}, 5400)`.mapWith(Number),
    })
    .from(locations)
    .leftJoin(userSavedLocations, eq(userSavedLocations.locationId, locations.id))
    .leftJoin(userMovieFollows, eq(userMovieFollows.locationId, locations.id))
    .leftJoin(locationSyncStates, eq(locationSyncStates.locationId, locations.id))
    .groupBy(
      locations.id,
      locations.normalizedKey,
      locations.postalCode,
      locations.label,
      locations.radiusMiles,
      locationSyncStates.lastSuccessfulSyncAt,
      locationSyncStates.staleAfterSeconds,
    );

  return rows
    .filter((row) => row.activeUserCount > 0)
    .sort((left, right) => {
      if (right.followedMovieCount !== left.followedMovieCount) {
        return right.followedMovieCount - left.followedMovieCount;
      }

      if (right.activeUserCount !== left.activeUserCount) {
        return right.activeUserCount - left.activeUserCount;
      }

      return left.normalizedKey.localeCompare(right.normalizedKey);
    })
    .slice(0, limit);
}

export async function getLocationCluster(locationId: string) {
  const db = getDb();

  const [row] = await db
    .select({
      locationId: locations.id,
      normalizedKey: locations.normalizedKey,
      postalCode: locations.postalCode,
      label: locations.label,
      radiusMiles: locations.radiusMiles,
      lastSuccessfulSyncAt: locationSyncStates.lastSuccessfulSyncAt,
      staleAfterSeconds: sql<number>`coalesce(${locationSyncStates.staleAfterSeconds}, 5400)`.mapWith(Number),
    })
    .from(locations)
    .leftJoin(locationSyncStates, eq(locationSyncStates.locationId, locations.id))
    .where(eq(locations.id, locationId))
    .orderBy(asc(locations.normalizedKey))
    .limit(1);

  return row ?? null;
}
