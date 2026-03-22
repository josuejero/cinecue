import { getDb } from "@/db/client";
import { userMovieFollows } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { jsonFromError } from "@/lib/phase2/errors";
import { resolveUserLocation } from "@/lib/phase2/locations";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ movieId: string }> },
) {
  try {
    const { movieId } = await params;
    const locationId = new URL(request.url).searchParams.get("locationId");
    const user = await getOrCreateAppUser();
    const location = await resolveUserLocation(user.id, locationId);

    const db = getDb();

    await db
      .delete(userMovieFollows)
      .where(
        and(
          eq(userMovieFollows.userId, user.id),
          eq(userMovieFollows.locationId, location.locationId),
          eq(userMovieFollows.movieId, movieId),
        ),
      );

    return NextResponse.json({
      removed: true,
      movieId,
      locationId: location.locationId,
    });
  } catch (error) {
    return jsonFromError(error);
  }
}