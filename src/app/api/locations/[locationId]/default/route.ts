import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { jsonFromError } from "@/lib/phase2/errors";
import { trackProductEvent } from "@/lib/phase6/analytics";
import { invalidateDashboardCacheForUser } from "@/lib/phase6/dashboard-cache";
import { listUserSavedLocations, setDefaultSavedLocation } from "@/lib/phase6/locations";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
  try {
    const { locationId } = await params;
    const user = await getOrCreateAppUser();

    await setDefaultSavedLocation(user.id, locationId);
    await invalidateDashboardCacheForUser(user.id);
    await trackProductEvent({
      userId: user.id,
      locationId,
      eventName: "location_default_changed",
      properties: { compatibilityRoute: true },
    });

    const locations = await listUserSavedLocations(user.id);
    const location = locations.find((item) => item.locationId === locationId) ?? null;

    return NextResponse.json({ location, locations });
  } catch (error) {
    return jsonFromError(error);
  }
}
