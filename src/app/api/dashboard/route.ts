import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { jsonFromError } from "@/lib/phase2/errors";
import { resolveUserLocation } from "@/lib/phase2/locations";
import { getFollowedMovieIds, loadDashboard } from "@/lib/phase2/queries";
import { refreshSelectedMovieLocalStatuses } from "@/lib/phase2/read-model";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const locationId = new URL(request.url).searchParams.get("locationId");
    const user = await getOrCreateAppUser();
    const location = await resolveUserLocation(user.id, locationId);

    const followedMovieIds = await getFollowedMovieIds(user.id, location.locationId);
    await refreshSelectedMovieLocalStatuses(location.locationId, followedMovieIds);

    const dashboard = await loadDashboard(user.id, location.locationId);

    return NextResponse.json({
      location,
      ...dashboard,
    });
  } catch (error) {
    return jsonFromError(error);
  }
}