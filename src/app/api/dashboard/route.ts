import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/modules/auth/server";
import { loadDashboard } from "@/modules/availability/queries";
import { jsonFromError } from "@/shared/http/errors";
import { getFollowedMovieIds } from "@/modules/follows/server";
import { resolveUserLocation } from "@/modules/locations/server";
import { refreshSelectedMovieLocalStatuses } from "@/modules/availability/read-model";
import { trackProductEvent } from "@/modules/analytics/server";
import {
  readDashboardCache,
  writeDashboardCache,
} from "@/modules/availability/dashboard-cache";
import { markLocationUsed } from "@/modules/locations/server";
import { assertRateLimit } from "@/shared/infra/rate-limit";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const locationId = url.searchParams.get("locationId");
    const refresh = url.searchParams.get("refresh") === "true";
    const user = await getOrCreateAppUser();

    await assertRateLimit({
      request,
      scope: "dashboard",
      subject: user.id,
      limit: 60,
      windowSeconds: 60,
    });

    const location = await resolveUserLocation(user.id, locationId);

    await markLocationUsed(user.id, location.locationId);

    const cacheScope = `location:${location.locationId}`;
    const cached = refresh
      ? null
      : await readDashboardCache<Awaited<ReturnType<typeof loadDashboard>> & {
          location: typeof location;
        }>(user.id, cacheScope);

    if (cached) {
      await trackProductEvent({
        userId: user.id,
        locationId: location.locationId,
        eventName: "dashboard_view",
        properties: { refresh: false, cacheHit: true },
      });

      return NextResponse.json(cached);
    }

    if (refresh) {
      const followedMovieIds = await getFollowedMovieIds(user.id, location.locationId);
      await refreshSelectedMovieLocalStatuses(location.locationId, followedMovieIds);
    }

    const dashboard = await loadDashboard(user.id, location.locationId);
    const payload = {
      location,
      ...dashboard,
    };

    await writeDashboardCache(user.id, cacheScope, payload);
    await trackProductEvent({
      userId: user.id,
      locationId: location.locationId,
      eventName: "dashboard_view",
      properties: { refresh, cacheHit: false },
    });

    return NextResponse.json(payload);
  } catch (error) {
    return jsonFromError(error);
  }
}
