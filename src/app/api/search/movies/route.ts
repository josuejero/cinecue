import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/modules/auth/server";
import { BadRequestError, jsonFromError } from "@/shared/http/errors";
import { resolveUserLocation } from "@/modules/locations/server";
import { trackProductEvent } from "@/modules/analytics/server";
import { searchMoviesForFollowFlow } from "@/modules/search/server";
import { assertRateLimit } from "@/shared/infra/rate-limit";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";
    const locationId = url.searchParams.get("locationId");
    const limit = Number(url.searchParams.get("limit") ?? 20);

    if (!query) {
      throw new BadRequestError("q is required.");
    }

    const user = await getOrCreateAppUser();

    await assertRateLimit({
      request,
      scope: "search.movies",
      subject: user.id,
      limit: 30,
      windowSeconds: 60,
    });

    const location = await resolveUserLocation(user.id, locationId);
    const results = await searchMoviesForFollowFlow({
      userId: user.id,
      locationId: location.locationId,
      query,
      limit,
    });

    await trackProductEvent({
      userId: user.id,
      locationId: location.locationId,
      eventName: "search",
      properties: {
        queryLength: query.length,
        resultCount: results.length,
      },
    });

    return NextResponse.json({
      query,
      location,
      results,
    });
  } catch (error) {
    return jsonFromError(error);
  }
}
