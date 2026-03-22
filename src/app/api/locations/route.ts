import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { BadRequestError, jsonFromError } from "@/lib/phase2/errors";
import { getUserSavedLocations, saveUserLocation } from "@/lib/phase2/locations";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await getOrCreateAppUser();
    const savedLocations = await getUserSavedLocations(user.id);

    return NextResponse.json({
      locations: savedLocations,
    });
  } catch (error) {
    return jsonFromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      zip?: string;
      label?: string;
      radiusMiles?: number;
      makeDefault?: boolean;
    };

    if (!body.zip) {
      throw new BadRequestError("zip is required.");
    }

    const user = await getOrCreateAppUser();
    const location = await saveUserLocation(user.id, {
      zip: body.zip,
      label: body.label,
      radiusMiles: Number(body.radiusMiles ?? 25),
      makeDefault: Boolean(body.makeDefault),
    });

    return NextResponse.json(
      {
        location,
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonFromError(error);
  }
}