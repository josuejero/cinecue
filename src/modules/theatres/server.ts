import { and, asc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { showtimes, theatres } from "@/db/schema";

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
