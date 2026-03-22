import { getDb } from "@/db/client";
import { movies, userMovieFollows } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { BadRequestError, jsonFromError, NotFoundError } from "@/lib/phase2/errors";
import { resolveUserLocation } from "@/lib/phase2/locations";
import { loadMovieDetail } from "@/lib/phase2/queries";
import { refreshMovieLocalStatusForLocation } from "@/lib/phase2/read-model";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import crypto from "node:crypto";

function createId() {
  return crypto.randomUUID();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      movieId?: string;
      locationId?: string;
    };

    if (!body.movieId) {
      throw new BadRequestError("movieId is required.");
    }

    const db = getDb();
    const user = await getOrCreateAppUser();
    const location = await resolveUserLocation(user.id, body.locationId ?? null);

    const [movie] = await db
      .select({ id: movies.id })
      .from(movies)
      .where(eq(movies.id, body.movieId))
      .limit(1);

    if (!movie) {
      throw new NotFoundError("Movie not found.");
    }

    await db
      .insert(userMovieFollows)
      .values({
        id: createId(),
        userId: user.id,
        movieId: body.movieId,
        locationId: location.locationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          userMovieFollows.userId,
          userMovieFollows.movieId,
          userMovieFollows.locationId,
        ],
        set: {
          updatedAt: new Date(),
        },
      });

    await refreshMovieLocalStatusForLocation(location.locationId, body.movieId);
    const detail = await loadMovieDetail({
      userId: user.id,
      locationId: location.locationId,
      movieId: body.movieId,
    });

    return NextResponse.json(
      {
        follow: {
          movieId: body.movieId,
          locationId: location.locationId,
        },
        movie: detail.movie,
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonFromError(error);
  }
}