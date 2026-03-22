import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const sourceProviderEnum = pgEnum("source_provider", [
  "gracenote",
  "tmdb",
  "imdb",
  "app",
]);

export const locationKindEnum = pgEnum("location_kind", ["zip", "coordinates"]);

export const providerSyncStatusEnum = pgEnum("provider_sync_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);

export const mappingConflictStatusEnum = pgEnum("mapping_conflict_status", [
  "open",
  "resolved",
  "ignored",
]);

export const matchConfidenceEnum = pgEnum("match_confidence", [
  "high",
  "medium",
  "low",
]);

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

export const workerJobRunStatusEnum = pgEnum("worker_job_run_status", [
  "running",
  "succeeded",
  "failed",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "push",
]);

export const notificationDeliveryStatusEnum = pgEnum("notification_delivery_status", [
  "pending",
  "sent",
  "failed",
  "skipped",
]);

export const appRuntimeState = pgTable("app_runtime_state", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const locations = pgTable(
  "locations",
  {
    id: text("id").primaryKey(),
    kind: locationKindEnum("kind").notNull().default("zip"),
    normalizedKey: text("normalized_key").notNull(),
    label: text("label"),
    postalCode: varchar("postal_code", { length: 20 }),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    radiusMiles: integer("radius_miles").notNull().default(25),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    normalizedKeyUnique: uniqueIndex("locations_normalized_key_unique").on(
      table.normalizedKey,
    ),
  }),
);

export const appUsers = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    authSubject: text("auth_subject").notNull(),
    email: text("email"),
    name: text("name"),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    authSubjectUnique: uniqueIndex("users_auth_subject_unique").on(table.authSubject),
    emailIdx: index("users_email_idx").on(table.email),
  }),
);

export const userSavedLocations = pgTable(
  "user_saved_locations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    label: text("label"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userLocationUnique: uniqueIndex("user_saved_locations_user_location_unique").on(
      table.userId,
      table.locationId,
    ),
    userDefaultIdx: index("user_saved_locations_user_default_idx").on(
      table.userId,
      table.isDefault,
    ),
  }),
);

export const theatres = pgTable(
  "theatres",
  {
    id: text("id").primaryKey(),
    identityKey: text("identity_key").notNull(),
    chainName: text("chain_name"),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    address1: text("address_1"),
    address2: text("address_2"),
    city: text("city"),
    state: text("state"),
    postalCode: varchar("postal_code", { length: 20 }),
    countryCode: varchar("country_code", { length: 3 }).notNull().default("USA"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    phone: text("phone"),
    timeZone: text("time_zone"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    identityKeyUnique: uniqueIndex("theatres_identity_key_unique").on(table.identityKey),
    postalCodeIdx: index("theatres_postal_code_idx").on(table.postalCode),
    normalizedNameIdx: index("theatres_normalized_name_idx").on(table.normalizedName),
  }),
);

export const theatreExternalIds = pgTable(
  "theatre_external_ids",
  {
    theatreId: text("theatre_id")
      .notNull()
      .references(() => theatres.id, { onDelete: "cascade" }),
    provider: sourceProviderEnum("provider").notNull(),
    externalType: text("external_type").notNull().default("theatreId"),
    externalId: text("external_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({
      name: "theatre_external_ids_pk",
      columns: [table.provider, table.externalType, table.externalId],
    }),
    theatreIdIdx: index("theatre_external_ids_theatre_id_idx").on(table.theatreId),
  }),
);

export const movies = pgTable(
  "movies",
  {
    id: text("id").primaryKey(),
    canonicalTitle: text("canonical_title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    releaseYear: integer("release_year"),
    releaseDate: date("release_date"),
    entityType: text("entity_type").notNull().default("Movie"),
    subType: text("sub_type"),
    shortDescription: text("short_description"),
    longDescription: text("long_description"),
    runtimeMinutes: integer("runtime_minutes"),
    posterUrl: text("poster_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    normalizedTitleIdx: index("movies_normalized_title_idx").on(table.normalizedTitle),
    releaseYearIdx: index("movies_release_year_idx").on(table.releaseYear),
  }),
);

export const movieExternalIds = pgTable(
  "movie_external_ids",
  {
    movieId: text("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    provider: sourceProviderEnum("provider").notNull(),
    externalType: text("external_type").notNull(),
    externalId: text("external_id").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    confidence: matchConfidenceEnum("confidence").notNull().default("high"),
    matchedBy: text("matched_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({
      name: "movie_external_ids_pk",
      columns: [table.provider, table.externalType, table.externalId],
    }),
    movieIdIdx: index("movie_external_ids_movie_id_idx").on(table.movieId),
  }),
);

export const providerSyncRuns = pgTable(
  "provider_sync_runs",
  {
    id: text("id").primaryKey(),
    provider: sourceProviderEnum("provider").notNull(),
    jobType: text("job_type").notNull(),
    locationKey: text("location_key"),
    requestParams: jsonb("request_params").notNull().default(sql`'{}'::jsonb`),
    status: providerSyncStatusEnum("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => ({
    providerJobIdx: index("provider_sync_runs_provider_job_idx").on(
      table.provider,
      table.jobType,
    ),
    locationStartedIdx: index("provider_sync_runs_location_started_idx").on(
      table.locationKey,
      table.startedAt,
    ),
  }),
);

export const providerPayloadArchive = pgTable(
  "provider_payload_archive",
  {
    id: text("id").primaryKey(),
    syncRunId: text("sync_run_id")
      .notNull()
      .references(() => providerSyncRuns.id, { onDelete: "cascade" }),
    provider: sourceProviderEnum("provider").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceKey: text("resource_key").notNull(),
    payload: jsonb("payload").notNull(),
    payloadHash: text("payload_hash").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    syncRunIdx: index("provider_payload_archive_sync_run_idx").on(table.syncRunId),
    resourceIdx: index("provider_payload_archive_resource_idx").on(
      table.provider,
      table.resourceType,
    ),
  }),
);

export const providerMappingConflicts = pgTable(
  "provider_mapping_conflicts",
  {
    id: text("id").primaryKey(),
    conflictKey: text("conflict_key").notNull(),
    provider: sourceProviderEnum("provider").notNull(),
    externalType: text("external_type").notNull(),
    externalId: text("external_id").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    releaseYear: integer("release_year"),
    candidateMovieIds: jsonb("candidate_movie_ids").notNull().default(sql`'[]'::jsonb`),
    reason: text("reason").notNull(),
    sourcePayload: jsonb("source_payload").notNull().default(sql`'{}'::jsonb`),
    status: mappingConflictStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    conflictKeyUnique: uniqueIndex("provider_mapping_conflicts_key_unique").on(
      table.conflictKey,
    ),
    statusIdx: index("provider_mapping_conflicts_status_idx").on(table.status),
  }),
);

export const userMovieFollows = pgTable(
  "user_movie_follows",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    movieId: text("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userMovieLocationUnique: uniqueIndex("user_movie_follows_user_movie_location_unique").on(
      table.userId,
      table.movieId,
      table.locationId,
    ),
    userLocationIdx: index("user_movie_follows_user_location_idx").on(
      table.userId,
      table.locationId,
    ),
    movieLocationIdx: index("user_movie_follows_movie_location_idx").on(
      table.movieId,
      table.locationId,
    ),
  }),
);

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
  }),
);

export const availabilityChangeEvents = pgTable(
  "availability_change_events",
  {
    id: text("id").primaryKey(),
    eventKey: text("event_key").notNull(),
    eventKind: availabilityEventKindEnum("event_kind")
      .notNull()
      .default("status_changed"),
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

export const workerJobRuns = pgTable(
  "worker_job_runs",
  {
    id: text("id").primaryKey(),
    queueName: text("queue_name").notNull(),
    jobName: text("job_name").notNull(),
    jobId: text("job_id"),
    deduplicationKey: text("deduplication_key"),
    locationId: text("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    providerSyncRunId: text("provider_sync_run_id").references(() => providerSyncRuns.id, {
      onDelete: "set null",
    }),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    resultSummary: jsonb("result_summary").notNull().default(sql`'{}'::jsonb`),
    status: workerJobRunStatusEnum("status").notNull(),
    attempt: integer("attempt").notNull().default(1),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    queueStatusStartedIdx: index("worker_job_runs_queue_status_started_idx").on(
      table.queueName,
      table.status,
      table.startedAt,
    ),
    locationStartedIdx: index("worker_job_runs_location_started_idx").on(
      table.locationId,
      table.startedAt,
    ),
    jobNameStartedIdx: index("worker_job_runs_job_name_started_idx").on(
      table.jobName,
      table.startedAt,
    ),
  }),
);
