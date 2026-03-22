import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  userNotificationPreferences,
  webPushSubscriptions,
} from "@/db/schema";
import { getServerEnv } from "@/lib/env";

function createId() {
  return crypto.randomUUID();
}

export type NotificationPreferenceShape = {
  emailEnabled: boolean;
  pushEnabled: boolean;
  newlyScheduledEnabled: boolean;
  nowPlayingEnabled: boolean;
  advanceTicketsEnabled: boolean;
  theatreCountIncreasedEnabled: boolean;
  finalShowingSoonEnabled: boolean;
};

export function defaultNotificationPreferences(): NotificationPreferenceShape {
  return {
    emailEnabled: true,
    pushEnabled: false,
    newlyScheduledEnabled: true,
    nowPlayingEnabled: true,
    advanceTicketsEnabled: true,
    theatreCountIncreasedEnabled: true,
    finalShowingSoonEnabled: true,
  };
}

export function applyNotificationPreferenceDefaults(
  row:
    | {
        emailEnabled?: boolean | null;
        pushEnabled?: boolean | null;
        newlyScheduledEnabled?: boolean | null;
        nowPlayingEnabled?: boolean | null;
        advanceTicketsEnabled?: boolean | null;
        theatreCountIncreasedEnabled?: boolean | null;
        finalShowingSoonEnabled?: boolean | null;
      }
    | null
    | undefined,
): NotificationPreferenceShape {
  const defaults = defaultNotificationPreferences();

  return {
    emailEnabled: row?.emailEnabled ?? defaults.emailEnabled,
    pushEnabled: row?.pushEnabled ?? defaults.pushEnabled,
    newlyScheduledEnabled:
      row?.newlyScheduledEnabled ?? defaults.newlyScheduledEnabled,
    nowPlayingEnabled: row?.nowPlayingEnabled ?? defaults.nowPlayingEnabled,
    advanceTicketsEnabled:
      row?.advanceTicketsEnabled ?? defaults.advanceTicketsEnabled,
    theatreCountIncreasedEnabled:
      row?.theatreCountIncreasedEnabled ?? defaults.theatreCountIncreasedEnabled,
    finalShowingSoonEnabled:
      row?.finalShowingSoonEnabled ?? defaults.finalShowingSoonEnabled,
  };
}

export function isEmailTransportConfigured() {
  const env = getServerEnv();
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_FROM);
}

export async function getOrCreateNotificationPreferences(userId: string) {
  const db = getDb();
  const defaults = defaultNotificationPreferences();

  await db
    .insert(userNotificationPreferences)
    .values({
      id: createId(),
      userId,
      ...defaults,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing({
      target: userNotificationPreferences.userId,
    });

  const [preferences] = await db
    .select()
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userId, userId))
    .limit(1);

  if (!preferences) {
    throw new Error("Failed to load notification preferences.");
  }

  const [subscriptionCountRow] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(webPushSubscriptions)
    .where(
      and(
        eq(webPushSubscriptions.userId, userId),
        eq(webPushSubscriptions.isActive, true),
      ),
    );

  return {
    ...preferences,
    pushSubscriptionCount: Number(subscriptionCountRow?.count ?? 0),
  };
}

export async function updateNotificationPreferences(
  userId: string,
  input: Partial<NotificationPreferenceShape>,
) {
  const db = getDb();
  const defaults = defaultNotificationPreferences();

  await db
    .insert(userNotificationPreferences)
    .values({
      id: createId(),
      userId,
      emailEnabled: input.emailEnabled ?? defaults.emailEnabled,
      pushEnabled: input.pushEnabled ?? defaults.pushEnabled,
      newlyScheduledEnabled:
        input.newlyScheduledEnabled ?? defaults.newlyScheduledEnabled,
      nowPlayingEnabled: input.nowPlayingEnabled ?? defaults.nowPlayingEnabled,
      advanceTicketsEnabled:
        input.advanceTicketsEnabled ?? defaults.advanceTicketsEnabled,
      theatreCountIncreasedEnabled:
        input.theatreCountIncreasedEnabled ?? defaults.theatreCountIncreasedEnabled,
      finalShowingSoonEnabled:
        input.finalShowingSoonEnabled ?? defaults.finalShowingSoonEnabled,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userNotificationPreferences.userId,
      set: {
        ...(typeof input.emailEnabled === "boolean"
          ? { emailEnabled: input.emailEnabled }
          : {}),
        ...(typeof input.pushEnabled === "boolean"
          ? { pushEnabled: input.pushEnabled }
          : {}),
        ...(typeof input.newlyScheduledEnabled === "boolean"
          ? { newlyScheduledEnabled: input.newlyScheduledEnabled }
          : {}),
        ...(typeof input.nowPlayingEnabled === "boolean"
          ? { nowPlayingEnabled: input.nowPlayingEnabled }
          : {}),
        ...(typeof input.advanceTicketsEnabled === "boolean"
          ? { advanceTicketsEnabled: input.advanceTicketsEnabled }
          : {}),
        ...(typeof input.theatreCountIncreasedEnabled === "boolean"
          ? {
              theatreCountIncreasedEnabled: input.theatreCountIncreasedEnabled,
            }
          : {}),
        ...(typeof input.finalShowingSoonEnabled === "boolean"
          ? { finalShowingSoonEnabled: input.finalShowingSoonEnabled }
          : {}),
        updatedAt: new Date(),
      },
    });

  return getOrCreateNotificationPreferences(userId);
}

export async function upsertWebPushSubscription(input: {
  userId: string;
  subscription: {
    endpoint: string;
    expirationTime: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  userAgent?: string | null;
}) {
  const db = getDb();

  await db
    .insert(webPushSubscriptions)
    .values({
      id: createId(),
      userId: input.userId,
      endpoint: input.subscription.endpoint,
      expirationTime: input.subscription.expirationTime,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      userAgent: input.userAgent ?? null,
      isActive: true,
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: webPushSubscriptions.endpoint,
      set: {
        userId: input.userId,
        expirationTime: input.subscription.expirationTime,
        p256dh: input.subscription.keys.p256dh,
        auth: input.subscription.keys.auth,
        userAgent: input.userAgent ?? null,
        isActive: true,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      },
    });
}

export async function deactivateWebPushSubscription(userId: string, endpoint: string) {
  const db = getDb();

  await db
    .update(webPushSubscriptions)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(webPushSubscriptions.userId, userId),
        eq(webPushSubscriptions.endpoint, endpoint),
      ),
    );
}
