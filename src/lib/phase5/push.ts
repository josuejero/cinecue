import crypto from "node:crypto";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import webpush from "web-push";
import { getDb } from "@/db/client";
import {
  appUsers,
  availabilityChangeEvents,
  locations,
  movies,
  notificationDeliveries,
  userMovieFollows,
  userNotificationPreferences,
  webPushSubscriptions,
} from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import {
  applyNotificationPreferenceDefaults,
  deactivateWebPushSubscription,
} from "@/lib/phase5/preferences";
import {
  PUSH_EVENT_KINDS,
  buildPushCopy,
  buildPushDeliveryKey,
  getPushSkipReason,
  shouldDeactivatePushSubscription,
  type PushEventKind,
} from "@/lib/phase5/push-payload";

function createId() {
  return crypto.randomUUID();
}

export function isPushConfigured() {
  const env = getServerEnv();
  return Boolean(
    env.WEB_PUSH_VAPID_PUBLIC_KEY &&
      env.WEB_PUSH_VAPID_PRIVATE_KEY &&
      env.WEB_PUSH_SUBJECT,
  );
}

export function getPushPublicKey() {
  const env = getServerEnv();

  if (!env.WEB_PUSH_VAPID_PUBLIC_KEY) {
    throw new Error("WEB_PUSH_VAPID_PUBLIC_KEY is not configured.");
  }

  return env.WEB_PUSH_VAPID_PUBLIC_KEY;
}

function configureWebPush() {
  const env = getServerEnv();

  if (!isPushConfigured()) {
    throw new Error(
      "Web push is not configured. Add WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, and WEB_PUSH_SUBJECT.",
    );
  }

  webpush.setVapidDetails(
    env.WEB_PUSH_SUBJECT!,
    env.WEB_PUSH_VAPID_PUBLIC_KEY!,
    env.WEB_PUSH_VAPID_PRIVATE_KEY!,
  );
}

export async function processPendingPushNotifications(input?: {
  dryRun?: boolean;
  limit?: number;
  daysBack?: number;
  locationId?: string | null;
}) {
  if (!isPushConfigured()) {
    return {
      ok: true,
      dryRun: Boolean(input?.dryRun),
      reason: "web_push_not_configured",
      scanned: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      items: [] as Array<{
        eventId: string;
        userId: string;
        movieId: string;
        locationId: string;
        subscriptionId: string;
        status: "would_send" | "sent" | "failed" | "skipped";
        subject: string | null;
        recipient: string;
        reason?: string;
        errorMessage?: string;
      }>,
    };
  }

  configureWebPush();

  const db = getDb();
  const env = getServerEnv();
  const dryRun = Boolean(input?.dryRun);
  const limit = Math.max(1, Math.min(input?.limit ?? env.PHASE5_PUSH_BATCH_SIZE, 500));
  const daysBack = Math.max(1, Math.min(input?.daysBack ?? 7, 30));
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const whereClause = input?.locationId
    ? and(
        gte(availabilityChangeEvents.changedAt, cutoff),
        eq(availabilityChangeEvents.locationId, input.locationId),
        inArray(availabilityChangeEvents.eventKind, [...PUSH_EVENT_KINDS]),
      )
    : and(
        gte(availabilityChangeEvents.changedAt, cutoff),
        inArray(availabilityChangeEvents.eventKind, [...PUSH_EVENT_KINDS]),
      );

  const rows = await db
    .select({
      eventId: availabilityChangeEvents.id,
      eventKind: availabilityChangeEvents.eventKind,
      changedAt: availabilityChangeEvents.changedAt,
      userId: appUsers.id,
      followCreatedAt: userMovieFollows.createdAt,
      movieId: movies.id,
      movieTitle: movies.canonicalTitle,
      locationId: locations.id,
      locationLabel: locations.label,
      newTheatreCount: availabilityChangeEvents.newTheatreCount,
      newNextShowingAt: availabilityChangeEvents.newNextShowingAt,
      subscriptionId: webPushSubscriptions.id,
      endpoint: webPushSubscriptions.endpoint,
      expirationTime: webPushSubscriptions.expirationTime,
      p256dh: webPushSubscriptions.p256dh,
      auth: webPushSubscriptions.auth,
      subscriptionCreatedAt: webPushSubscriptions.createdAt,
      emailEnabled: userNotificationPreferences.emailEnabled,
      pushEnabled: userNotificationPreferences.pushEnabled,
      newlyScheduledEnabled: userNotificationPreferences.newlyScheduledEnabled,
      nowPlayingEnabled: userNotificationPreferences.nowPlayingEnabled,
      advanceTicketsEnabled: userNotificationPreferences.advanceTicketsEnabled,
      theatreCountIncreasedEnabled:
        userNotificationPreferences.theatreCountIncreasedEnabled,
      finalShowingSoonEnabled:
        userNotificationPreferences.finalShowingSoonEnabled,
    })
    .from(availabilityChangeEvents)
    .innerJoin(movies, eq(availabilityChangeEvents.movieId, movies.id))
    .innerJoin(locations, eq(availabilityChangeEvents.locationId, locations.id))
    .innerJoin(
      userMovieFollows,
      and(
        eq(userMovieFollows.movieId, availabilityChangeEvents.movieId),
        eq(userMovieFollows.locationId, availabilityChangeEvents.locationId),
      ),
    )
    .innerJoin(appUsers, eq(userMovieFollows.userId, appUsers.id))
    .leftJoin(
      userNotificationPreferences,
      eq(userNotificationPreferences.userId, appUsers.id),
    )
    .innerJoin(
      webPushSubscriptions,
      and(
        eq(webPushSubscriptions.userId, appUsers.id),
        eq(webPushSubscriptions.isActive, true),
      ),
    )
    .where(whereClause)
    .orderBy(asc(availabilityChangeEvents.changedAt), asc(availabilityChangeEvents.id))
    .limit(limit);

  const summary = {
    ok: true,
    dryRun,
    scanned: rows.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    items: [] as Array<{
      eventId: string;
      userId: string;
      movieId: string;
      locationId: string;
      subscriptionId: string;
      status: "would_send" | "sent" | "failed" | "skipped";
      subject: string | null;
      recipient: string;
      reason?: string;
      errorMessage?: string;
    }>,
  };

  for (const row of rows) {
    const preferences = applyNotificationPreferenceDefaults(row);
    const deliveryKey = buildPushDeliveryKey(row.eventId, row.subscriptionId);
    const skipReason = getPushSkipReason({
      preferences,
      eventKind: row.eventKind,
      changedAt: row.changedAt,
      followCreatedAt: row.followCreatedAt,
      subscriptionCreatedAt: row.subscriptionCreatedAt,
    });

    const copy = buildPushCopy({
      eventKind: row.eventKind as PushEventKind,
      title: row.movieTitle,
      locationLabel: row.locationLabel,
      theatreCount: row.newTheatreCount,
      nextShowingAt: row.newNextShowingAt,
    });

    if (skipReason) {
      if (!dryRun) {
        const [delivery] = await db
          .insert(notificationDeliveries)
          .values({
            id: createId(),
            deliveryKey,
            channel: "push",
            userId: row.userId,
            locationId: row.locationId,
            movieId: row.movieId,
            availabilityChangeEventId: row.eventId,
            recipient: row.endpoint,
            subject: copy.title,
            status: "skipped",
            errorMessage: skipReason,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoNothing({
            target: notificationDeliveries.deliveryKey,
          })
          .returning({ id: notificationDeliveries.id });

        if (!delivery) {
          summary.skipped += 1;
          summary.items.push({
            eventId: row.eventId,
            userId: row.userId,
            movieId: row.movieId,
            locationId: row.locationId,
            subscriptionId: row.subscriptionId,
            status: "skipped",
            subject: copy.title,
            recipient: row.endpoint,
            reason: "delivery_already_exists",
          });
          continue;
        }
      }

      summary.skipped += 1;
      summary.items.push({
        eventId: row.eventId,
        userId: row.userId,
        movieId: row.movieId,
        locationId: row.locationId,
        subscriptionId: row.subscriptionId,
        status: "skipped",
        subject: copy.title,
        recipient: row.endpoint,
        reason: skipReason,
      });
      continue;
    }

    const payload = {
      title: copy.title,
      body: copy.body,
      tag: copy.tag,
      url: new URL(
        `/movies/${row.movieId}?locationId=${encodeURIComponent(row.locationId)}`,
        env.APP_BASE_URL,
      ).toString(),
      movieId: row.movieId,
      locationId: row.locationId,
      eventId: row.eventId,
    };

    if (dryRun) {
      summary.sent += 1;
      summary.items.push({
        eventId: row.eventId,
        userId: row.userId,
        movieId: row.movieId,
        locationId: row.locationId,
        subscriptionId: row.subscriptionId,
        status: "would_send",
        subject: copy.title,
        recipient: row.endpoint,
      });
      continue;
    }

    const [delivery] = await db
      .insert(notificationDeliveries)
      .values({
        id: createId(),
        deliveryKey,
        channel: "push",
        userId: row.userId,
        locationId: row.locationId,
        movieId: row.movieId,
        availabilityChangeEventId: row.eventId,
        recipient: row.endpoint,
        subject: copy.title,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing({
        target: notificationDeliveries.deliveryKey,
      })
      .returning({ id: notificationDeliveries.id });

    if (!delivery) {
      summary.skipped += 1;
      summary.items.push({
        eventId: row.eventId,
        userId: row.userId,
        movieId: row.movieId,
        locationId: row.locationId,
        subscriptionId: row.subscriptionId,
        status: "skipped",
        subject: copy.title,
        recipient: row.endpoint,
        reason: "delivery_already_exists",
      });
      continue;
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          expirationTime: row.expirationTime ?? undefined,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth,
          },
        },
        JSON.stringify(payload),
        {
          TTL: 60 * 60,
        },
      );

      await db
        .update(notificationDeliveries)
        .set({
          status: "sent",
          providerMessageId: row.endpoint,
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(notificationDeliveries.id, delivery.id));

      summary.sent += 1;
      summary.items.push({
        eventId: row.eventId,
        userId: row.userId,
        movieId: row.movieId,
        locationId: row.locationId,
        subscriptionId: row.subscriptionId,
        status: "sent",
        subject: copy.title,
        recipient: row.endpoint,
      });
    } catch (error) {
      if (shouldDeactivatePushSubscription(error)) {
        await deactivateWebPushSubscription(row.userId, row.endpoint);
      }

      const errorMessage =
        error instanceof Error ? error.message : "Unknown web push failure.";

      await db
        .update(notificationDeliveries)
        .set({
          status: "failed",
          errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(notificationDeliveries.id, delivery.id));

      summary.failed += 1;
      summary.items.push({
        eventId: row.eventId,
        userId: row.userId,
        movieId: row.movieId,
        locationId: row.locationId,
        subscriptionId: row.subscriptionId,
        status: "failed",
        subject: copy.title,
        recipient: row.endpoint,
        errorMessage,
      });
    }
  }

  return summary;
}
