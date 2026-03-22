import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { BadRequestError, jsonFromError } from "@/lib/phase2/errors";
import { resolveUserLocation } from "@/lib/phase2/locations";
import { searchMoviesForFollowFlow } from "@/lib/phase2/queries";
import { NextResponse } from "next/server";

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
    const location = await resolveUserLocation(user.id, locationId);

    const results = await searchMoviesForFollowFlow({
      userId: user.id,
      locationId: location.locationId,
      query,
      limit,
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