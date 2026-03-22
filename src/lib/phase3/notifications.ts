import crypto from "node:crypto";
import { and, asc, eq, gte, isNull } from "drizzle-orm";
import nodemailer from "nodemailer";
import { getDb } from "@/db/client";
import {
  appUsers,
  availabilityChangeEvents,
  locations,
  movies,
  notificationDeliveries,
  userMovieFollows,
  userNotificationPreferences,
} from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import {
  applyNotificationPreferenceDefaults,
  type NotificationPreferenceShape,
} from "@/lib/phase5/preferences";
import type { MovieAvailabilityStatus } from "@/lib/phase2/read-model";

export type NotificationKind =
  | "newly_scheduled"
  | "now_playing"
  | "advance_tickets";

function createId() {
  return crypto.randomUUID();
}

function createDeliveryKey(userId: string, eventId: string) {
  return `email:${userId}:${eventId}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function classifyAvailabilityChange(
  previousStatus: MovieAvailabilityStatus | null,
  newStatus: MovieAvailabilityStatus,
): NotificationKind | null {
  if (newStatus === "advance_tickets") {
    return "advance_tickets";
  }

  if (newStatus === "now_playing") {
    if (
      previousStatus === null ||
      previousStatus === "no_local_schedule_yet" ||
      previousStatus === "stopped_playing"
    ) {
      return "newly_scheduled";
    }

    return "now_playing";
  }

  return null;
}

function notificationKindFromEventKind(eventKind: string | null | undefined) {
  switch (eventKind) {
    case "newly_scheduled":
      return "newly_scheduled";
    case "now_playing":
      return "now_playing";
    case "advance_tickets":
      return "advance_tickets";
    default:
      return null;
  }
}

function isKindEnabled(kind: NotificationKind, prefs: NotificationPreferenceShape) {
  if (!prefs.emailEnabled) {
    return false;
  }

  switch (kind) {
    case "newly_scheduled":
      return prefs.newlyScheduledEnabled;
    case "now_playing":
      return prefs.nowPlayingEnabled;
    case "advance_tickets":
      return prefs.advanceTicketsEnabled;
    default:
      return false;
  }
}

export function isEmailTransportConfigured() {
  const env = getServerEnv();
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_FROM);
}

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const env = getServerEnv();

  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_FROM) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, and SMTP_FROM.",
    );
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure:
      env.SMTP_SECURE === "true" ||
      (env.SMTP_SECURE === undefined && env.SMTP_PORT === 465),
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : undefined,
  });

  return cachedTransporter;
}

function buildLocationLabel(label?: string | null, postalCode?: string | null) {
  if (label?.trim()) {
    return label.trim();
  }

  if (postalCode) {
    return `ZIP ${postalCode}`;
  }

  return "your saved area";
}

function buildMovieUrl(baseUrl: string, movieId: string, locationId: string) {
  const root = baseUrl.replace(/\/$/, "");
  return `${root}/movies/${movieId}?locationId=${encodeURIComponent(locationId)}`;
}

function buildEmailContent(input: {
  kind: NotificationKind;
  title: string;
  locationLabel: string;
  movieUrl: string;
  nextShowingAt: Date | null;
  theatreCount: number;
}) {
  const nextShowingText = input.nextShowingAt
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(input.nextShowingAt)
    : "Check CineCue for the latest showtimes.";

  let subject = `${input.title} update in ${input.locationLabel}`;
  let headline = "Movie availability update";
  let lead = `${input.title} changed status near ${input.locationLabel}.`;

  if (input.kind === "newly_scheduled") {
    subject = `${input.title} just got local showtimes near ${input.locationLabel}`;
    headline = "New local showtimes just appeared";
    lead = `${input.title} has local showtimes in ${input.locationLabel}.`;
  }

  if (input.kind === "now_playing") {
    subject = `${input.title} is now playing near ${input.locationLabel}`;
    headline = "Now playing near you";
    lead = `${input.title} moved into now playing status near ${input.locationLabel}.`;
  }

  if (input.kind === "advance_tickets") {
    subject = `Advance tickets for ${input.title} are live near ${input.locationLabel}`;
    headline = "Advance tickets available";
    lead = `${input.title} has advance tickets listed near ${input.locationLabel}.`;
  }

  const theatreSummary =
    input.theatreCount === 1
      ? "1 nearby theatre"
      : `${input.theatreCount} nearby theatres`;

  const safeHeadline = escapeHtml(headline);
  const safeLead = escapeHtml(lead);
  const safeNextShowingText = escapeHtml(nextShowingText);
  const safeTheatreSummary = escapeHtml(theatreSummary);
  const safeMovieUrl = escapeHtml(input.movieUrl);

  const text = [
    headline,
    "",
    lead,
    `Next showing: ${nextShowingText}`,
    `Coverage: ${theatreSummary}`,
    "",
    `Open movie page: ${input.movieUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.5;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">
        CineCue
      </p>
      <h1 style="margin: 0 0 12px; font-size: 24px;">${safeHeadline}</h1>
      <p style="margin: 0 0 12px;">${safeLead}</p>
      <p style="margin: 0 0 8px;"><strong>Next showing:</strong> ${safeNextShowingText}</p>
      <p style="margin: 0 0 20px;"><strong>Coverage:</strong> ${safeTheatreSummary}</p>
      <a
        href="${safeMovieUrl}"
        style="display: inline-block; padding: 12px 16px; border-radius: 12px; background: #111827; color: #ffffff; text-decoration: none; font-weight: 600;"
      >
        Open in CineCue
      </a>
    </div>
  `;

  return { subject, text, html };
}

export async function processPendingEmailNotifications(input?: {
  limit?: number;
  daysBack?: number;
  dryRun?: boolean;
  locationId?: string | null;
}) {
  const limit = Math.max(1, Math.min(input?.limit ?? 100, 500));
  const daysBack = Math.max(1, Math.min(input?.daysBack ?? 14, 90));
  const dryRun = Boolean(input?.dryRun);
  const db = getDb();
  const env = getServerEnv();

  if (!dryRun && !isEmailTransportConfigured()) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, and SMTP_FROM before sending alerts.",
    );
  }

  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const whereClause = input?.locationId
    ? and(
        gte(availabilityChangeEvents.changedAt, cutoff),
        eq(availabilityChangeEvents.locationId, input.locationId),
        isNull(notificationDeliveries.id),
      )
    : and(
        gte(availabilityChangeEvents.changedAt, cutoff),
        isNull(notificationDeliveries.id),
      );

  const rows = await db
    .select({
      eventId: availabilityChangeEvents.id,
      eventKind: availabilityChangeEvents.eventKind,
      changedAt: availabilityChangeEvents.changedAt,
      previousStatus: availabilityChangeEvents.previousStatus,
      newStatus: availabilityChangeEvents.newStatus,
      previousTheatreCount: availabilityChangeEvents.previousTheatreCount,
      newTheatreCount: availabilityChangeEvents.newTheatreCount,
      newNextShowingAt: availabilityChangeEvents.newNextShowingAt,
      userId: appUsers.id,
      userEmail: appUsers.email,
      followCreatedAt: userMovieFollows.createdAt,
      movieId: movies.id,
      movieTitle: movies.canonicalTitle,
      locationId: locations.id,
      locationLabel: locations.label,
      locationPostalCode: locations.postalCode,
      emailEnabled: userNotificationPreferences.emailEnabled,
      newlyScheduledEnabled: userNotificationPreferences.newlyScheduledEnabled,
      nowPlayingEnabled: userNotificationPreferences.nowPlayingEnabled,
      advanceTicketsEnabled: userNotificationPreferences.advanceTicketsEnabled,
      existingDeliveryId: notificationDeliveries.id,
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
    .leftJoin(
      notificationDeliveries,
      and(
        eq(notificationDeliveries.userId, appUsers.id),
        eq(notificationDeliveries.channel, "email"),
        eq(
          notificationDeliveries.availabilityChangeEventId,
          availabilityChangeEvents.id,
        ),
      ),
    )
    .where(whereClause)
    .orderBy(asc(availabilityChangeEvents.changedAt))
    .limit(limit);

  const summary = {
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
      status: "would_send" | "sent" | "failed" | "skipped";
      kind: NotificationKind | null;
      subject: string | null;
      recipient: string | null;
      reason?: string;
      errorMessage?: string;
    }>,
  };

  for (const row of rows) {
    const kind =
      notificationKindFromEventKind(row.eventKind) ??
      classifyAvailabilityChange(row.previousStatus, row.newStatus);

    const prefs = applyNotificationPreferenceDefaults(row);
    const recipient = row.userEmail;

    let skipReason: string | null = null;

    if (!kind) {
      skipReason = "no_supported_alert_type";
    } else if (row.followCreatedAt > row.changedAt) {
      skipReason = "follow_created_after_event";
    } else if (!recipient) {
      skipReason = "user_has_no_email";
    } else if (!isKindEnabled(kind, prefs)) {
      skipReason = "preferences_disabled";
    }

    if (skipReason) {
      summary.skipped += 1;
      summary.items.push({
        eventId: row.eventId,
        userId: row.userId,
        movieId: row.movieId,
        locationId: row.locationId,
        status: "skipped",
        kind,
        subject: null,
        recipient: recipient ?? null,
        reason: skipReason,
      });

      if (!dryRun) {
        await db
          .insert(notificationDeliveries)
          .values({
            id: createId(),
            deliveryKey: createDeliveryKey(row.userId, row.eventId),
            channel: "email",
            userId: row.userId,
            locationId: row.locationId,
            movieId: row.movieId,
            availabilityChangeEventId: row.eventId,
            recipient: recipient ?? "",
            subject: `${row.movieTitle} notification skipped`,
            status: "skipped",
            errorMessage: skipReason,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoNothing({
            target: notificationDeliveries.deliveryKey,
          });
      }

      continue;
    }

    if (!kind || !recipient) {
      continue;
    }

    const copy = buildEmailContent({
      kind,
      title: row.movieTitle,
      locationLabel: buildLocationLabel(
        row.locationLabel,
        row.locationPostalCode,
      ),
      movieUrl: buildMovieUrl(env.APP_BASE_URL, row.movieId, row.locationId),
      nextShowingAt: row.newNextShowingAt,
      theatreCount: row.newTheatreCount,
    });

    if (dryRun) {
      summary.items.push({
        eventId: row.eventId,
        userId: row.userId,
        movieId: row.movieId,
        locationId: row.locationId,
        status: "would_send",
        kind,
        subject: copy.subject,
        recipient,
      });
      continue;
    }

    const [delivery] = await db
      .insert(notificationDeliveries)
      .values({
        id: createId(),
        deliveryKey: createDeliveryKey(row.userId, row.eventId),
        channel: "email",
        userId: row.userId,
        locationId: row.locationId,
        movieId: row.movieId,
        availabilityChangeEventId: row.eventId,
        recipient,
        subject: copy.subject,
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
        status: "skipped",
        kind,
        subject: copy.subject,
        recipient,
        reason: "delivery_already_exists",
      });
      continue;
    }

    try {
      const info = (await getTransporter().sendMail({
        from: env.SMTP_FROM,
        to: recipient,
        subject: copy.subject,
        text: copy.text,
        html: copy.html,
      })) as { messageId?: string };

      await db
        .update(notificationDeliveries)
        .set({
          status: "sent",
          providerMessageId: info.messageId ?? null,
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
        status: "sent",
        kind,
        subject: copy.subject,
        recipient,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown email send failure.";

      await db
        .update(notificationDeliveries)
        .set({
          status: "failed",
          errorMessage: message,
          updatedAt: new Date(),
        })
        .where(eq(notificationDeliveries.id, delivery.id));

      summary.failed += 1;
      summary.items.push({
        eventId: row.eventId,
        userId: row.userId,
        movieId: row.movieId,
        locationId: row.locationId,
        status: "failed",
        kind,
        subject: copy.subject,
        recipient,
        errorMessage: message,
      });
    }
  }

  return summary;
}
