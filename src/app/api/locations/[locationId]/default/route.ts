import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/modules/auth/server";
import { jsonFromError } from "@/shared/http/errors";
import { trackProductEvent } from "@/modules/analytics/server";
import { invalidateDashboardCacheForUser } from "@/modules/availability/dashboard-cache";
import { listUserSavedLocations, setDefaultSavedLocation } from "@/modules/locations/server";
import { assertRateLimit } from "@/shared/infra/rate-limit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
  try {
    const { locationId } = await params;
    const user = await getOrCreateAppUser();

    await assertRateLimit({
      request,
      scope: "locations.default",
      subject: user.id,
      limit: 20,
      windowSeconds: 60,
    });

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
