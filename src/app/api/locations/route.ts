import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { BadRequestError, jsonFromError } from "@/lib/phase2/errors";
import { trackProductEvent } from "@/lib/phase6/analytics";
import { invalidateDashboardCacheForUser } from "@/lib/phase6/dashboard-cache";
import {
  createSavedLocationForUser,
  listUserSavedLocations,
  setDefaultSavedLocation,
} from "@/lib/phase6/locations";

export async function GET() {
  try {
    const user = await getOrCreateAppUser();
    const locations = await listUserSavedLocations(user.id);

    return NextResponse.json({ locations });
  } catch (error) {
    return jsonFromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<{
      zip: string;
      postalCode: string;
      label: string;
      radiusMiles: number;
      latitude: number;
      longitude: number;
      makeDefault: boolean;
    }>;
    const user = await getOrCreateAppUser();
    const locationId = await createSavedLocationForUser({
      userId: user.id,
      zip: body.zip ?? null,
      postalCode: body.postalCode ?? null,
      label: body.label ?? null,
      radiusMiles:
        typeof body.radiusMiles === "number" && Number.isFinite(body.radiusMiles)
          ? body.radiusMiles
          : null,
      latitude:
        typeof body.latitude === "number" && Number.isFinite(body.latitude)
          ? body.latitude
          : null,
      longitude:
        typeof body.longitude === "number" && Number.isFinite(body.longitude)
          ? body.longitude
          : null,
      makeDefault: Boolean(body.makeDefault),
    });

    await invalidateDashboardCacheForUser(user.id);
    await trackProductEvent({
      userId: user.id,
      locationId,
      eventName: "location_saved",
      properties: {
        makeDefault: Boolean(body.makeDefault),
        mode: body.postalCode || body.zip ? "zip" : "coordinates",
      },
    });

    const locations = await listUserSavedLocations(user.id);
    const location = locations.find((item) => item.locationId === locationId) ?? null;

    return NextResponse.json(
      {
        location,
        locations,
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonFromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<{
      locationId: string;
      makeDefault: boolean;
    }>;

    if (!body.locationId) {
      throw new BadRequestError("locationId is required.");
    }

    if (body.makeDefault !== true) {
      throw new BadRequestError("This route currently supports makeDefault=true only.");
    }

    const user = await getOrCreateAppUser();
    await setDefaultSavedLocation(user.id, body.locationId);
    await invalidateDashboardCacheForUser(user.id);
    await trackProductEvent({
      userId: user.id,
      locationId: body.locationId,
      eventName: "location_default_changed",
      properties: {},
    });

    const locations = await listUserSavedLocations(user.id);
    const location = locations.find((item) => item.locationId === body.locationId) ?? null;

    return NextResponse.json({
      location,
      locations,
    });
  } catch (error) {
    return jsonFromError(error);
  }
}
