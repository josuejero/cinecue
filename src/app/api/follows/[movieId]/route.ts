import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/modules/auth/server";
import { removeFollow } from "@/modules/follows/server";
import { jsonFromError } from "@/shared/http/errors";
import { resolveUserLocation } from "@/modules/locations/server";
import { trackProductEvent } from "@/modules/analytics/server";
import { invalidateDashboardCacheForUser } from "@/modules/availability/dashboard-cache";
import { assertRateLimit } from "@/shared/infra/rate-limit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ movieId: string }> },
) {
  try {
    const { movieId } = await params;
    const locationId = new URL(request.url).searchParams.get("locationId");
    const user = await getOrCreateAppUser();

    await assertRateLimit({
      request,
      scope: "follows.delete",
      subject: user.id,
      limit: 30,
      windowSeconds: 60,
    });

    const location = await resolveUserLocation(user.id, locationId);
    await removeFollow({
      userId: user.id,
      locationId: location.locationId,
      movieId,
    });

    await invalidateDashboardCacheForUser(user.id);
    await trackProductEvent({
      userId: user.id,
      locationId: location.locationId,
      movieId,
      eventName: "unfollow",
      properties: {},
    });

    return NextResponse.json({
      removed: true,
      movieId,
      locationId: location.locationId,
    });
  } catch (error) {
    return jsonFromError(error);
  }
}
