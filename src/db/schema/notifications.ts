import {
  bigint,
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { availabilityChangeEvents } from "./availability";
import { appUsers } from "./auth";
import { locations } from "./locations";
import { movies } from "./catalog";

export const notificationChannelEnum = pgEnum("notification_channel", ["email", "push"]);

export const notificationDeliveryStatusEnum = pgEnum("notification_delivery_status", [
  "pending",
  "sent",
  "failed",
  "skipped",
]);

export const userNotificationPreferences = pgTable(
  "user_notification_preferences",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    pushEnabled: boolean("push_enabled").notNull().default(false),
    newlyScheduledEnabled: boolean("newly_scheduled_enabled").notNull().default(true),
    nowPlayingEnabled: boolean("now_playing_enabled").notNull().default(true),
    advanceTicketsEnabled: boolean("advance_tickets_enabled").notNull().default(true),
    theatreCountIncreasedEnabled: boolean("theatre_count_increased_enabled")
      .notNull()
      .default(true),
    finalShowingSoonEnabled: boolean("final_showing_soon_enabled")
      .notNull()
      .default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdUnique: uniqueIndex("user_notification_preferences_user_id_unique").on(
      table.userId,
    ),
  }),
);

export const webPushSubscriptions = pgTable(
  "web_push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    expirationTime: bigint("expiration_time", { mode: "number" }),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    isActive: boolean("is_active").notNull().default(true),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    endpointUnique: uniqueIndex("web_push_subscriptions_endpoint_unique").on(
      table.endpoint,
    ),
    userActiveIdx: index("web_push_subscriptions_user_active_idx").on(
      table.userId,
      table.isActive,
    ),
  }),
);

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: text("id").primaryKey(),
    deliveryKey: text("delivery_key").notNull(),
    channel: notificationChannelEnum("channel").notNull().default("email"),
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    movieId: text("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    availabilityChangeEventId: text("availability_change_event_id")
      .notNull()
      .references(() => availabilityChangeEvents.id, { onDelete: "cascade" }),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    status: notificationDeliveryStatusEnum("status").notNull().default("pending"),
    providerMessageId: text("provider_message_id"),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    deliveryKeyUnique: uniqueIndex("notification_deliveries_delivery_key_unique").on(
      table.deliveryKey,
    ),
    userStatusIdx: index("notification_deliveries_user_status_idx").on(
      table.userId,
      table.status,
    ),
    statusCreatedIdx: index("notification_deliveries_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
    eventIdx: index("notification_deliveries_event_idx").on(
      table.availabilityChangeEventId,
    ),
  }),
);
