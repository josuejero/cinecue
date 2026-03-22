CREATE TYPE "public"."availability_event_kind" AS ENUM(
  'status_changed',
  'newly_scheduled',
  'now_playing',
  'advance_tickets',
  'stopped_playing',
  'theatre_count_increased',
  'final_showing_soon'
);
--> statement-breakpoint

CREATE TYPE "public"."worker_job_run_status" AS ENUM(
  'running',
  'succeeded',
  'failed'
);
--> statement-breakpoint

ALTER TABLE "availability_change_events"
  ADD COLUMN "event_key" text;
--> statement-breakpoint

ALTER TABLE "availability_change_events"
  ADD COLUMN "event_kind" "availability_event_kind" DEFAULT 'status_changed' NOT NULL;
--> statement-breakpoint

ALTER TABLE "availability_change_events"
  ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint

ALTER TABLE "availability_change_events"
  ADD COLUMN "source_sync_run_id" text;
--> statement-breakpoint

ALTER TABLE "availability_change_events"
  ADD COLUMN "suppressed_at" timestamp with time zone;
--> statement-breakpoint

ALTER TABLE "availability_change_events"
  ADD COLUMN "suppression_reason" text;
--> statement-breakpoint

UPDATE "availability_change_events"
SET "event_key" = 'legacy:' || "id"
WHERE "event_key" IS NULL;
--> statement-breakpoint

ALTER TABLE "availability_change_events"
  ALTER COLUMN "event_key" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "availability_change_events"
  ADD CONSTRAINT "availability_change_events_source_sync_run_id_provider_sync_runs_id_fk"
  FOREIGN KEY ("source_sync_run_id")
  REFERENCES "public"."provider_sync_runs"("id")
  ON DELETE set null
  ON UPDATE no action;
--> statement-breakpoint

CREATE UNIQUE INDEX "availability_change_events_event_key_unique"
  ON "availability_change_events" USING btree ("event_key");
--> statement-breakpoint

CREATE INDEX "availability_change_events_kind_changed_at_idx"
  ON "availability_change_events" USING btree ("event_kind", "changed_at");
--> statement-breakpoint

CREATE TABLE "location_sync_state" (
  "location_id" text PRIMARY KEY NOT NULL,
  "last_showings_sync_run_id" text,
  "last_showings_sync_at" timestamp with time zone,
  "last_read_model_refresh_at" timestamp with time zone,
  "last_notification_enqueue_at" timestamp with time zone,
  "last_successful_sync_at" timestamp with time zone,
  "stale_after_seconds" integer DEFAULT 5400 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "location_sync_state"
  ADD CONSTRAINT "location_sync_state_location_id_locations_id_fk"
  FOREIGN KEY ("location_id")
  REFERENCES "public"."locations"("id")
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "location_sync_state"
  ADD CONSTRAINT "location_sync_state_last_showings_sync_run_id_provider_sync_runs_id_fk"
  FOREIGN KEY ("last_showings_sync_run_id")
  REFERENCES "public"."provider_sync_runs"("id")
  ON DELETE set null
  ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "location_sync_state_last_successful_sync_idx"
  ON "location_sync_state" USING btree ("last_successful_sync_at");
--> statement-breakpoint

CREATE TABLE "worker_job_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "queue_name" text NOT NULL,
  "job_name" text NOT NULL,
  "job_id" text,
  "deduplication_key" text,
  "location_id" text,
  "provider_sync_run_id" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "result_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" "worker_job_run_status" NOT NULL,
  "attempt" integer DEFAULT 1 NOT NULL,
  "error_message" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "worker_job_runs"
  ADD CONSTRAINT "worker_job_runs_location_id_locations_id_fk"
  FOREIGN KEY ("location_id")
  REFERENCES "public"."locations"("id")
  ON DELETE set null
  ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "worker_job_runs"
  ADD CONSTRAINT "worker_job_runs_provider_sync_run_id_provider_sync_runs_id_fk"
  FOREIGN KEY ("provider_sync_run_id")
  REFERENCES "public"."provider_sync_runs"("id")
  ON DELETE set null
  ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "worker_job_runs_queue_status_started_idx"
  ON "worker_job_runs" USING btree ("queue_name", "status", "started_at");
--> statement-breakpoint

CREATE INDEX "worker_job_runs_location_started_idx"
  ON "worker_job_runs" USING btree ("location_id", "started_at");
--> statement-breakpoint

CREATE INDEX "worker_job_runs_job_name_started_idx"
  ON "worker_job_runs" USING btree ("job_name", "started_at");
--> statement-breakpoint

CREATE INDEX "showtimes_location_start_at_idx"
  ON "showtimes" USING btree ("location_id", "start_at_local");
--> statement-breakpoint

CREATE INDEX "notification_deliveries_status_created_idx"
  ON "notification_deliveries" USING btree ("status", "created_at");
--> statement-breakpoint

CREATE INDEX "provider_sync_runs_location_started_idx"
  ON "provider_sync_runs" USING btree ("location_key", "started_at");
