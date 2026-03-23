import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { availabilityChangeEvents, userMovieFollows } from "@/db/schema";

export function formatSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function formatSseComment(text: string) {
  return `: ${text}\n\n`;
}

export async function getLatestAvailabilityCursor(input: {
  userId: string;
  locationId: string;
}) {
  const db = getDb();

  const [row] = await db
    .select({
      eventId: availabilityChangeEvents.id,
      changedAt: availabilityChangeEvents.changedAt,
    })
    .from(availabilityChangeEvents)
    .innerJoin(
      userMovieFollows,
      and(
        eq(userMovieFollows.movieId, availabilityChangeEvents.movieId),
        eq(userMovieFollows.locationId, availabilityChangeEvents.locationId),
        eq(userMovieFollows.userId, input.userId),
      ),
    )
    .where(eq(availabilityChangeEvents.locationId, input.locationId))
    .orderBy(desc(availabilityChangeEvents.changedAt), desc(availabilityChangeEvents.id))
    .limit(1);

  if (!row) {
    return null;
  }

  return `${row.eventId}:${new Date(row.changedAt).toISOString()}`;
}
