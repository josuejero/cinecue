import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { jsonFromError } from "@/lib/phase2/errors";
import { resolveUserLocation } from "@/lib/phase2/locations";
import { loadMovieDetail } from "@/lib/phase2/queries";
import { refreshMovieLocalStatusForLocation } from "@/lib/phase2/read-model";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ movieId: string }> },
) {
  try {
    const { movieId } = await params;
    const locationId = new URL(request.url).searchParams.get("locationId");
    const user = await getOrCreateAppUser();
    const location = await resolveUserLocation(user.id, locationId);

    await refreshMovieLocalStatusForLocation(location.locationId, movieId);

    const detail = await loadMovieDetail({
      userId: user.id,
      locationId: location.locationId,
      movieId,
    });

    return NextResponse.json({
      location,
      ...detail,
    });
  } catch (error) {
    return jsonFromError(error);
  }
}