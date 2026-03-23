import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { locations } from "./locations";
import { movies, providerSyncRuns, sourceProviderEnum } from "./catalog";
import { theatres } from "./theatres";

export const movieAvailabilityStatusEnum = pgEnum("movie_availability_status", [
  "now_playing",
  "advance_tickets",
  "coming_soon",
  "no_local_schedule_yet",
  "stopped_playing",
]);

export const availabilityEventKindEnum = pgEnum("availability_event_kind", [
  "status_changed",
  "newly_scheduled",
  "now_playing",
  "advance_tickets",
  "stopped_playing",
  "theatre_count_increased",
  "final_showing_soon",
]);

export const showtimes = pgTable(
  "showtimes",
  {
    id: text("id").primaryKey(),
    movieId: text("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    theatreId: text("theatre_id")
      .notNull()
      .references(() => theatres.id, { onDelete: "cascade" }),
    locationId: text("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    provider: sourceProviderEnum("provider").notNull(),
    sourceMovieExternalId: text("source_movie_external_id"),
    startAtLocal: timestamp("start_at_local", { withTimezone: false }).notNull(),
    businessDate: date("business_date").notNull(),
    qualities: text("qualities"),
    ticketUrl: text("ticket_url"),
    isBargain: boolean("is_bargain").notNull().default(false),
    isAdvanceTicket: boolean("is_advance_ticket").notNull().default(false),
    rawShowtime: jsonb("raw_showtime").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueShowtimeByLocation: uniqueIndex(
      "showtimes_provider_location_theatre_movie_start_unique",
    ).on(
      table.provider,
      table.locationId,
      table.theatreId,
      table.movieId,
      table.startAtLocal,
    ),
    movieLocationDateIdx: index("showtimes_movie_location_date_idx").on(
      table.movieId,
      table.locationId,
      table.businessDate,
    ),
    theatreLocationDateIdx: index("showtimes_theatre_location_date_idx").on(
      table.theatreId,
      table.locationId,
      table.businessDate,
    ),
    locationStartAtIdx: index("showtimes_location_start_at_idx").on(
      table.locationId,
      table.startAtLocal,
    ),
    locationMovieStartIdx: index("showtimes_location_movie_start_idx").on(
      table.locationId,
      table.movieId,
      table.startAtLocal,
    ),
    locationTheatreStartIdx: index("showtimes_location_theatre_start_idx").on(
      table.locationId,
      table.theatreId,
      table.startAtLocal,
    ),
  }),
);

export const movieLocalStatuses = pgTable(
  "movie_local_status",
  {
    movieId: text("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    status: movieAvailabilityStatusEnum("status").notNull(),
    nextShowingAt: timestamp("next_showing_at", { withTimezone: false }),
    firstShowingAt: timestamp("first_showing_at", { withTimezone: false }),
    lastShowingAt: timestamp("last_showing_at", { withTimezone: false }),
    theatreCount: integer("theatre_count").notNull().default(0),
    lastSeenInProviderAt: timestamp("last_seen_in_provider_at", {
      withTimezone: true,
    }).notNull().defaultNow(),
    statusChangedAt: timestamp("status_changed_at", {
      withTimezone: true,
    }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({
      name: "movie_local_status_pk",
      columns: [table.movieId, table.locationId],
    }),
    locationStatusIdx: index("movie_local_status_location_status_idx").on(
      table.locationId,
      table.status,
    ),
    locationNextShowingIdx: index("movie_local_status_location_next_showing_idx").on(
      table.locationId,
      table.nextShowingAt,
    ),
    locationStatusNextIdx: index("movie_local_status_location_status_next_idx").on(
      table.locationId,
      table.status,
      table.nextShowingAt,
    ),
  }),
);

export const availabilityChangeEvents = pgTable(
  "availability_change_events",
  {
    id: text("id").primaryKey(),
    eventKey: text("event_key").notNull(),
    eventKind: availabilityEventKindEnum("event_kind").notNull().default("status_changed"),
    movieId: text("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    previousStatus: movieAvailabilityStatusEnum("previous_status"),
    newStatus: movieAvailabilityStatusEnum("new_status").notNull(),
    previousTheatreCount: integer("previous_theatre_count"),
    newTheatreCount: integer("new_theatre_count").notNull(),
    previousNextShowingAt: timestamp("previous_next_showing_at", {
      withTimezone: false,
    }),
    newNextShowingAt: timestamp("new_next_showing_at", {
      withTimezone: false,
    }),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    sourceSyncRunId: text("source_sync_run_id").references(() => providerSyncRuns.id, {
      onDelete: "set null",
    }),
    suppressedAt: timestamp("suppressed_at", { withTimezone: true }),
    suppressionReason: text("suppression_reason"),
  },
  (table) => ({
    eventKeyUnique: uniqueIndex("availability_change_events_event_key_unique").on(
      table.eventKey,
    ),
    locationChangedAtIdx: index("availability_change_events_location_changed_at_idx").on(
      table.locationId,
      table.changedAt,
    ),
    movieChangedAtIdx: index("availability_change_events_movie_changed_at_idx").on(
      table.movieId,
      table.changedAt,
    ),
    kindChangedAtIdx: index("availability_change_events_kind_changed_at_idx").on(
      table.eventKind,
      table.changedAt,
    ),
  }),
);

export const locationSyncStates = pgTable(
  "location_sync_state",
  {
    locationId: text("location_id")
      .primaryKey()
      .references(() => locations.id, { onDelete: "cascade" }),
    lastShowingsSyncRunId: text("last_showings_sync_run_id").references(
      () => providerSyncRuns.id,
      { onDelete: "set null" },
    ),
    lastShowingsSyncAt: timestamp("last_showings_sync_at", { withTimezone: true }),
    lastReadModelRefreshAt: timestamp("last_read_model_refresh_at", {
      withTimezone: true,
    }),
    lastNotificationEnqueueAt: timestamp("last_notification_enqueue_at", {
      withTimezone: true,
    }),
    lastSuccessfulSyncAt: timestamp("last_successful_sync_at", {
      withTimezone: true,
    }),
    staleAfterSeconds: integer("stale_after_seconds").notNull().default(5400),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    lastSuccessfulSyncIdx: index("location_sync_state_last_successful_sync_idx").on(
      table.lastSuccessfulSyncAt,
    ),
  }),
);
