import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { BadRequestError, jsonFromError } from "@/lib/phase2/errors";
import { resolveUserLocation } from "@/lib/phase2/locations";
import { trackProductEvent } from "@/lib/phase6/analytics";
import { searchMoviesForFollowFlowPhase6 } from "@/lib/phase6/search";
import { assertRateLimit } from "@/lib/rate-limit";

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
    const results = await searchMoviesForFollowFlowPhase6({
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
