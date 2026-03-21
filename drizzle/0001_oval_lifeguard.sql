CREATE TYPE "public"."location_kind" AS ENUM('zip', 'coordinates');--> statement-breakpoint
CREATE TYPE "public"."mapping_conflict_status" AS ENUM('open', 'resolved', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."match_confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."provider_sync_status" AS ENUM('pending', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."source_provider" AS ENUM('gracenote', 'tmdb', 'imdb', 'app');--> statement-breakpoint
CREATE TABLE "locations" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "location_kind" DEFAULT 'zip' NOT NULL,
	"normalized_key" text NOT NULL,
	"label" text,
	"postal_code" varchar(20),
	"latitude" double precision,
	"longitude" double precision,
	"radius_miles" integer DEFAULT 25 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movie_external_ids" (
	"movie_id" text NOT NULL,
	"provider" "source_provider" NOT NULL,
	"external_type" text NOT NULL,
	"external_id" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"confidence" "match_confidence" DEFAULT 'high' NOT NULL,
	"matched_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movie_external_ids_pk" PRIMARY KEY("provider","external_type","external_id")
);
--> statement-breakpoint
CREATE TABLE "movies" (
	"id" text PRIMARY KEY NOT NULL,
	"canonical_title" text NOT NULL,
	"normalized_title" text NOT NULL,
	"release_year" integer,
	"release_date" date,
	"entity_type" text DEFAULT 'Movie' NOT NULL,
	"sub_type" text,
	"short_description" text,
	"long_description" text,
	"runtime_minutes" integer,
	"poster_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_mapping_conflicts" (
	"id" text PRIMARY KEY NOT NULL,
	"conflict_key" text NOT NULL,
	"provider" "source_provider" NOT NULL,
	"external_type" text NOT NULL,
	"external_id" text NOT NULL,
	"normalized_title" text NOT NULL,
	"release_year" integer,
	"candidate_movie_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reason" text NOT NULL,
	"source_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "mapping_conflict_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_payload_archive" (
	"id" text PRIMARY KEY NOT NULL,
	"sync_run_id" text NOT NULL,
	"provider" "source_provider" NOT NULL,
	"resource_type" text NOT NULL,
	"resource_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_sync_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" "source_provider" NOT NULL,
	"job_type" text NOT NULL,
	"location_key" text,
	"request_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "provider_sync_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "showtimes" (
	"id" text PRIMARY KEY NOT NULL,
	"movie_id" text NOT NULL,
	"theatre_id" text NOT NULL,
	"provider" "source_provider" NOT NULL,
	"source_movie_external_id" text,
	"start_at_local" timestamp NOT NULL,
	"business_date" date NOT NULL,
	"qualities" text,
	"ticket_url" text,
	"is_bargain" boolean DEFAULT false NOT NULL,
	"is_advance_ticket" boolean DEFAULT false NOT NULL,
	"raw_showtime" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theatre_external_ids" (
	"theatre_id" text NOT NULL,
	"provider" "source_provider" NOT NULL,
	"external_type" text DEFAULT 'theatreId' NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theatre_external_ids_pk" PRIMARY KEY("provider","external_type","external_id")
);
--> statement-breakpoint
CREATE TABLE "theatres" (
	"id" text PRIMARY KEY NOT NULL,
	"identity_key" text NOT NULL,
	"chain_name" text,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"address_1" text,
	"address_2" text,
	"city" text,
	"state" text,
	"postal_code" varchar(20),
	"country_code" varchar(3) DEFAULT 'USA' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"phone" text,
	"time_zone" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movie_external_ids" ADD CONSTRAINT "movie_external_ids_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_payload_archive" ADD CONSTRAINT "provider_payload_archive_sync_run_id_provider_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."provider_sync_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showtimes" ADD CONSTRAINT "showtimes_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showtimes" ADD CONSTRAINT "showtimes_theatre_id_theatres_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."theatres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theatre_external_ids" ADD CONSTRAINT "theatre_external_ids_theatre_id_theatres_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."theatres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "locations_normalized_key_unique" ON "locations" USING btree ("normalized_key");--> statement-breakpoint
CREATE INDEX "movie_external_ids_movie_id_idx" ON "movie_external_ids" USING btree ("movie_id");--> statement-breakpoint
CREATE INDEX "movies_normalized_title_idx" ON "movies" USING btree ("normalized_title");--> statement-breakpoint
CREATE INDEX "movies_release_year_idx" ON "movies" USING btree ("release_year");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_mapping_conflicts_key_unique" ON "provider_mapping_conflicts" USING btree ("conflict_key");--> statement-breakpoint
CREATE INDEX "provider_mapping_conflicts_status_idx" ON "provider_mapping_conflicts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "provider_payload_archive_sync_run_idx" ON "provider_payload_archive" USING btree ("sync_run_id");--> statement-breakpoint
CREATE INDEX "provider_payload_archive_resource_idx" ON "provider_payload_archive" USING btree ("provider","resource_type");--> statement-breakpoint
CREATE INDEX "provider_sync_runs_provider_job_idx" ON "provider_sync_runs" USING btree ("provider","job_type");--> statement-breakpoint
CREATE UNIQUE INDEX "showtimes_provider_theatre_movie_start_unique" ON "showtimes" USING btree ("provider","theatre_id","movie_id","start_at_local");--> statement-breakpoint
CREATE INDEX "showtimes_movie_date_idx" ON "showtimes" USING btree ("movie_id","business_date");--> statement-breakpoint
CREATE INDEX "showtimes_theatre_date_idx" ON "showtimes" USING btree ("theatre_id","business_date");--> statement-breakpoint
CREATE INDEX "theatre_external_ids_theatre_id_idx" ON "theatre_external_ids" USING btree ("theatre_id");--> statement-breakpoint
CREATE UNIQUE INDEX "theatres_identity_key_unique" ON "theatres" USING btree ("identity_key");--> statement-breakpoint
CREATE INDEX "theatres_postal_code_idx" ON "theatres" USING btree ("postal_code");--> statement-breakpoint
CREATE INDEX "theatres_normalized_name_idx" ON "theatres" USING btree ("normalized_name");