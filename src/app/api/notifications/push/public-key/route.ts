import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/modules/auth/server";
import { jsonFromError } from "@/shared/http/errors";
import { getPushPublicKey, isPushConfigured } from "@/modules/notifications/push";
import { assertRateLimit } from "@/shared/infra/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getOrCreateAppUser();

    await assertRateLimit({
      request,
      scope: "notifications.push.public-key",
      subject: user.id,
      limit: 30,
      windowSeconds: 60,
    });

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
