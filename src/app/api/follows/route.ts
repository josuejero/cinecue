import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/modules/auth/server";
import {
  loadMovieDetail,
  resolveOrCreateMovieFromTmdbId,
} from "@/modules/catalog/server";
import { BadRequestError, jsonFromError } from "@/shared/http/errors";
import { createFollow } from "@/modules/follows/server";
import { resolveUserLocation } from "@/modules/locations/server";
import { refreshMovieLocalStatusForLocation } from "@/modules/availability/read-model";
import { trackProductEvent } from "@/modules/analytics/server";
import { invalidateDashboardCacheForUser } from "@/modules/availability/dashboard-cache";
import { assertRateLimit } from "@/shared/infra/rate-limit";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      movieId?: string;
      locationId?: string;
      source?: {
        provider?: string;
        tmdbId?: string;
      };
    };

    const hasMovieId = Boolean(body.movieId);
    const hasSource = Boolean(body.source);

    if (hasMovieId === hasSource) {
      throw new BadRequestError("Exactly one of movieId or source is required.");
    }

    if (
      body.source &&
      (body.source.provider !== "tmdb" || !body.source.tmdbId?.trim())
    ) {
      throw new BadRequestError("source.provider=tmdb and source.tmdbId are required.");
    }

    const user = await getOrCreateAppUser();

    await assertRateLimit({
      request,
      scope: "follows.create",
      subject: user.id,
      limit: 30,
      windowSeconds: 60,
    });

    const location = await resolveUserLocation(user.id, body.locationId ?? null);
    const movieId = body.movieId
      ? body.movieId
      : (await resolveOrCreateMovieFromTmdbId(body.source!.tmdbId!.trim())).movieId;

    await createFollow({
      userId: user.id,
      movieId,
      locationId: location.locationId,
    });

    await refreshMovieLocalStatusForLocation(location.locationId, movieId);
    const detail = await loadMovieDetail({
      userId: user.id,
      locationId: location.locationId,
      movieId,
    });

    await invalidateDashboardCacheForUser(user.id);
    await trackProductEvent({
      userId: user.id,
      locationId: location.locationId,
      movieId,
      eventName: "follow",
      properties: {},
    });

    return NextResponse.json(
      {
        follow: {
          movieId,
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
