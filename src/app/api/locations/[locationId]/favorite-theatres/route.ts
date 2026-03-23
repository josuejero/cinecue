import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/modules/auth/server";
import { BadRequestError, jsonFromError } from "@/shared/http/errors";
import { trackProductEvent } from "@/modules/analytics/server";
import { invalidateDashboardCacheForUser } from "@/modules/availability/dashboard-cache";
import {
  addFavoriteTheatre,
  listFavoriteTheatreIds,
  removeFavoriteTheatre,
} from "@/modules/locations/server";
import { assertRateLimit } from "@/shared/infra/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
  try {
    const { locationId } = await params;
    const body = (await request.json().catch(() => ({}))) as { theatreId?: string };

    if (!body.theatreId) {
      throw new BadRequestError("theatreId is required.");
    }

    const user = await getOrCreateAppUser();

    await assertRateLimit({
      request,
      scope: "favorite-theatres.create",
      subject: user.id,
      limit: 30,
      windowSeconds: 60,
    });

    await addFavoriteTheatre({
      userId: user.id,
      locationId,
      theatreId: body.theatreId,
    });

    await invalidateDashboardCacheForUser(user.id);
    await trackProductEvent({
      userId: user.id,
      locationId,
      eventName: "favorite_theatre_added",
      properties: { theatreId: body.theatreId },
    });

    return NextResponse.json({
      ok: true,
      favoriteTheatreIds: await listFavoriteTheatreIds(user.id, locationId),
    });
  } catch (error) {
    return jsonFromError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
  try {
    const { locationId } = await params;
    const body = (await request.json().catch(() => ({}))) as { theatreId?: string };

    if (!body.theatreId) {
      throw new BadRequestError("theatreId is required.");
    }

    const user = await getOrCreateAppUser();

    await assertRateLimit({
      request,
      scope: "favorite-theatres.delete",
      subject: user.id,
      limit: 30,
      windowSeconds: 60,
    });

    await removeFavoriteTheatre({
      userId: user.id,
      locationId,
      theatreId: body.theatreId,
    });

    await invalidateDashboardCacheForUser(user.id);
    await trackProductEvent({
      userId: user.id,
      locationId,
      eventName: "favorite_theatre_removed",
      properties: { theatreId: body.theatreId },
    });

    return NextResponse.json({
      ok: true,
      favoriteTheatreIds: await listFavoriteTheatreIds(user.id, locationId),
    });
  } catch (error) {
    return jsonFromError(error);
  }
}
