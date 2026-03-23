import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/modules/auth/server";
import { loadMovieDetail } from "@/modules/catalog/server";
import { jsonFromError } from "@/shared/http/errors";
import { resolveUserLocation } from "@/modules/locations/server";
import { refreshMovieLocalStatusForLocation } from "@/modules/availability/read-model";
import { listFavoriteTheatreIds, markLocationUsed } from "@/modules/locations/server";
import { assertRateLimit } from "@/shared/infra/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ movieId: string }> },
) {
  try {
    const { movieId } = await params;
    const url = new URL(request.url);
    const locationId = url.searchParams.get("locationId");
    const refresh = url.searchParams.get("refresh") === "true";
    const user = await getOrCreateAppUser();

    await assertRateLimit({
      request,
      scope: "movies.detail",
      subject: user.id,
      limit: 60,
      windowSeconds: 60,
    });

    const location = await resolveUserLocation(user.id, locationId);

    await markLocationUsed(user.id, location.locationId);

    if (refresh) {
      await refreshMovieLocalStatusForLocation(location.locationId, movieId);
    }

    const detail = await loadMovieDetail({
      userId: user.id,
      locationId: location.locationId,
      movieId,
    });
    const favoriteTheatreIds = await listFavoriteTheatreIds(user.id, location.locationId);
    const favoriteSet = new Set(favoriteTheatreIds);

    detail.movie.nearbyTheatres = [...detail.movie.nearbyTheatres].sort((left, right) => {
      return Number(favoriteSet.has(right.theatreId)) - Number(favoriteSet.has(left.theatreId));
    });

    return NextResponse.json({
      location,
      favoriteTheatreIds,
      calendarExportUrl: `/api/movies/${movieId}/calendar?locationId=${encodeURIComponent(location.locationId)}`,
      ...detail,
    });
  } catch (error) {
    return jsonFromError(error);
  }
}
