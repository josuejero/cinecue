import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { jsonFromError } from "@/lib/phase2/errors";
import { isPushConfigured } from "@/lib/phase5/push";
import {
  getOrCreateNotificationPreferences,
  isEmailTransportConfigured,
  updateNotificationPreferences,
} from "@/lib/phase5/preferences";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getOrCreateAppUser();
    const preferences = await getOrCreateNotificationPreferences(user.id);

    return NextResponse.json({
      email: user.email ?? null,
      smtpConfigured: isEmailTransportConfigured(),
      pushConfigured: isPushConfigured(),
      preferences,
    });
  } catch (error) {
    return jsonFromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getOrCreateAppUser();
    const body = (await request.json().catch(() => ({}))) as Partial<{
      emailEnabled: boolean;
      pushEnabled: boolean;
      newlyScheduledEnabled: boolean;
      nowPlayingEnabled: boolean;
      advanceTicketsEnabled: boolean;
      theatreCountIncreasedEnabled: boolean;
      finalShowingSoonEnabled: boolean;
    }>;

    const preferences = await updateNotificationPreferences(user.id, {
      emailEnabled:
        typeof body.emailEnabled === "boolean" ? body.emailEnabled : undefined,
      pushEnabled:
        typeof body.pushEnabled === "boolean" ? body.pushEnabled : undefined,
      newlyScheduledEnabled:
        typeof body.newlyScheduledEnabled === "boolean"
          ? body.newlyScheduledEnabled
          : undefined,
      nowPlayingEnabled:
        typeof body.nowPlayingEnabled === "boolean"
          ? body.nowPlayingEnabled
          : undefined,
      advanceTicketsEnabled:
        typeof body.advanceTicketsEnabled === "boolean"
          ? body.advanceTicketsEnabled
          : undefined,
      theatreCountIncreasedEnabled:
        typeof body.theatreCountIncreasedEnabled === "boolean"
          ? body.theatreCountIncreasedEnabled
          : undefined,
      finalShowingSoonEnabled:
        typeof body.finalShowingSoonEnabled === "boolean"
          ? body.finalShowingSoonEnabled
          : undefined,
    });

    return NextResponse.json({
      email: user.email ?? null,
      smtpConfigured: isEmailTransportConfigured(),
      pushConfigured: isPushConfigured(),
      preferences,
    });
  } catch (error) {
    return jsonFromError(error);
  }
}
