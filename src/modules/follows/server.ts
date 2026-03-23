import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { movies, userMovieFollows } from "@/db/schema";
import { NotFoundError } from "@/shared/http/errors";

function createId() {
  return crypto.randomUUID();
}

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

export async function createFollow(input: {
  userId: string;
  movieId: string;
  locationId: string;
}) {
  const db = getDb();

  const [movie] = await db
    .select({ id: movies.id })
    .from(movies)
    .where(eq(movies.id, input.movieId))
    .limit(1);

  if (!movie) {
    throw new NotFoundError("Movie not found.");
  }

  await db
    .insert(userMovieFollows)
    .values({
      id: createId(),
      userId: input.userId,
      movieId: input.movieId,
      locationId: input.locationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        userMovieFollows.userId,
        userMovieFollows.movieId,
        userMovieFollows.locationId,
      ],
      set: { updatedAt: new Date() },
    });
}

export async function removeFollow(input: {
  userId: string;
  movieId: string;
  locationId: string;
}) {
  const db = getDb();

  await db.delete(userMovieFollows).where(
    and(
      eq(userMovieFollows.userId, input.userId),
      eq(userMovieFollows.locationId, input.locationId),
      eq(userMovieFollows.movieId, input.movieId),
    ),
  );
}
