import { NextResponse } from "next/server";
import { listAvailabilityChanges } from "@/modules/availability/queries";
import { getOrCreateAppUser } from "@/modules/auth/server";
import { jsonFromError } from "@/shared/http/errors";
import { resolveUserLocation } from "@/modules/locations/server";
import { assertRateLimit } from "@/shared/infra/rate-limit";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const locationId = url.searchParams.get("locationId");
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const user = await getOrCreateAppUser();

    await assertRateLimit({
      request,
      scope: "availability.changes",
      subject: user.id,
      limit: 60,
      windowSeconds: 60,
    });

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
