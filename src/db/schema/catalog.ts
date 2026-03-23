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

export const sourceProviderEnum = pgEnum("source_provider", [
  "gracenote",
  "tmdb",
  "imdb",
  "app",
]);

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
