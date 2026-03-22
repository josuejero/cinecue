import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { jsonFromError } from "@/lib/phase2/errors";
import { getPushPublicKey, isPushConfigured } from "@/lib/phase5/push";

export const runtime = "nodejs";

export async function GET() {
  try {
    await getOrCreateAppUser();

    if (!isPushConfigured()) {
      return NextResponse.json(
        {
          error: "Web push is not configured on the server.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      publicKey: getPushPublicKey(),
    });
  } catch (error) {
    return jsonFromError(error);
  }
}
