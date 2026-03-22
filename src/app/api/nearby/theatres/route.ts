import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { jsonFromError } from "@/lib/phase2/errors";
import { resolveUserLocation } from "@/lib/phase2/locations";
import { listNearbyTheatresForLocation } from "@/lib/phase2/queries";
import { assertRateLimit } from "@/lib/rate-limit";

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
