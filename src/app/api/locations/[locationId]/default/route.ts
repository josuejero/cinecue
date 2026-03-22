import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { jsonFromError } from "@/lib/phase2/errors";
import { setDefaultUserLocation } from "@/lib/phase2/locations";
import { NextResponse } from "next/server";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
  try {
    const { locationId } = await params;
    const user = await getOrCreateAppUser();
    const location = await setDefaultUserLocation(user.id, locationId);

    return NextResponse.json({ location });
  } catch (error) {
    return jsonFromError(error);
  }
}