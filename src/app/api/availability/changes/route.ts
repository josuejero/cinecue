import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { jsonFromError } from "@/lib/phase2/errors";
import { resolveUserLocation } from "@/lib/phase2/locations";
import { listAvailabilityChanges } from "@/lib/phase2/queries";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const locationId = url.searchParams.get("locationId");
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const user = await getOrCreateAppUser();
    const location = await resolveUserLocation(user.id, locationId);

    const changes = await listAvailabilityChanges({
      userId: user.id,
      locationId: location.locationId,
      limit,
    });

    return NextResponse.json({
      location,
      changes,
    });
  } catch (error) {
    return jsonFromError(error);
  }
}