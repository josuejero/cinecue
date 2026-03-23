import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { appUsers } from "./auth";
import { locations } from "./locations";
import { movies } from "./catalog";

export const productAnalyticsEvents = pgTable(
  "product_analytics_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => appUsers.id, { onDelete: "set null" }),
    locationId: text("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    movieId: text("movie_id").references(() => movies.id, { onDelete: "set null" }),
    sessionId: text("session_id"),
    eventName: text("event_name").notNull(),
    properties: jsonb("properties").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    eventCreatedIdx: index("product_analytics_events_event_created_idx").on(
      table.eventName,
      table.createdAt,
    ),
    userCreatedIdx: index("product_analytics_events_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    locationCreatedIdx: index("product_analytics_events_location_created_idx").on(
      table.locationId,
      table.createdAt,
    ),
  }),
);
