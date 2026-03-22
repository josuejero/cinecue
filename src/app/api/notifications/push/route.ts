import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { BadRequestError, jsonFromError } from "@/lib/phase2/errors";
import { isPushConfigured } from "@/lib/phase5/push";
import {
  deactivateWebPushSubscription,
  upsertWebPushSubscription,
} from "@/lib/phase5/preferences";
import { assertRateLimit } from "@/lib/rate-limit";

type PushSubscriptionInput = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isPushConfigured()) {
      throw new BadRequestError("Web push is not configured.");
    }

    const user = await getOrCreateAppUser();

    await assertRateLimit({
      request,
      scope: "notifications.push.subscribe",
      subject: user.id,
      limit: 20,
      windowSeconds: 60,
    });

    const body = (await request.json().catch(() => ({}))) as PushSubscriptionInput;

    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      throw new BadRequestError("A complete PushSubscription payload is required.");
    }

    await upsertWebPushSubscription({
      userId: user.id,
      subscription: {
        endpoint: body.endpoint,
        expirationTime: body.expirationTime ?? null,
        keys: {
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
        },
      },
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonFromError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getOrCreateAppUser();

    await assertRateLimit({
      request,
      scope: "notifications.push.unsubscribe",
      subject: user.id,
      limit: 20,
      windowSeconds: 60,
    });

    const body = (await request.json().catch(() => ({}))) as {
      endpoint?: string;
    };

    if (!body.endpoint) {
      throw new BadRequestError("endpoint is required.");
    }

    await deactivateWebPushSubscription(user.id, body.endpoint);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonFromError(error);
  }
}
