import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/modules/auth/server";
import { loadMovieDetail } from "@/modules/catalog/server";
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
    };

    if (!body.movieId) {
      throw new BadRequestError("movieId is required.");
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

    await createFollow({
      userId: user.id,
      movieId: body.movieId,
      locationId: location.locationId,
    });

    await refreshMovieLocalStatusForLocation(location.locationId, body.movieId);
    const detail = await loadMovieDetail({
      userId: user.id,
      locationId: location.locationId,
      movieId: body.movieId,
    });

    await invalidateDashboardCacheForUser(user.id);
    await trackProductEvent({
      userId: user.id,
      locationId: location.locationId,
      movieId: body.movieId,
      eventName: "follow",
      properties: {},
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
