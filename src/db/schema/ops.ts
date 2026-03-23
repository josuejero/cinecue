import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { locations } from "./locations";
import { providerSyncRuns } from "./catalog";

export const workerJobRunStatusEnum = pgEnum("worker_job_run_status", [
  "running",
  "succeeded",
  "failed",
]);

export const appRuntimeState = pgTable("app_runtime_state", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
