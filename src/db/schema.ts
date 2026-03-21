import { sql } from "drizzle-orm";
import {
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
    uniqueShowtime: uniqueIndex("showtimes_provider_theatre_movie_start_unique").on(
      table.provider,
      table.theatreId,
      table.movieId,
      table.startAtLocal,
    ),
    movieDateIdx: index("showtimes_movie_date_idx").on(table.movieId, table.businessDate),
    theatreDateIdx: index("showtimes_theatre_date_idx").on(
      table.theatreId,
      table.businessDate,
    ),
  }),
);