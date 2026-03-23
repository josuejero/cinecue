import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/modules/auth/server";
import { jsonFromError } from "@/shared/http/errors";
import { resolveUserLocation } from "@/modules/locations/server";
import { listNearbyTheatresForLocation } from "@/modules/theatres/server";
import { assertRateLimit } from "@/shared/infra/rate-limit";

export async function GET(request: Request) {
  try {
    const locationId = new URL(request.url).searchParams.get("locationId");
    const user = await getOrCreateAppUser();

    await assertRateLimit({
      request,
      scope: "nearby.theatres",
      subject: user.id,
      limit: 60,
      windowSeconds: 60,
    });

    const location = await resolveUserLocation(user.id, locationId);
    const theatres = await listNearbyTheatresForLocation(location.locationId);

    return NextResponse.json({
      location,
      theatres,
    });
  } catch (error) {
    return jsonFromError(error);
  }
}
