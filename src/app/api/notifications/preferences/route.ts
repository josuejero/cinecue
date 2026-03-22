import { getOrCreateAppUser } from "@/lib/phase2/auth";
import { jsonFromError } from "@/lib/phase2/errors";
import {
  getOrCreateNotificationPreferences,
  isEmailTransportConfigured,
  updateNotificationPreferences,
} from "@/lib/phase3/notifications";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await getOrCreateAppUser();
    const preferences = await getOrCreateNotificationPreferences(user.id);

    return NextResponse.json({
      email: user.email ?? null,
      smtpConfigured: isEmailTransportConfigured(),
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
      newlyScheduledEnabled: boolean;
      nowPlayingEnabled: boolean;
      advanceTicketsEnabled: boolean;
    }>;

    const preferences = await updateNotificationPreferences(user.id, {
      emailEnabled:
        typeof body.emailEnabled === "boolean" ? body.emailEnabled : undefined,
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
    });

    return NextResponse.json({
      email: user.email ?? null,
      smtpConfigured: isEmailTransportConfigured(),
      preferences,
    });
  } catch (error) {
    return jsonFromError(error);
  }
}
