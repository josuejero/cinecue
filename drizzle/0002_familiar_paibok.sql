CREATE TYPE "public"."movie_availability_status" AS ENUM('now_playing', 'advance_tickets', 'coming_soon', 'no_local_schedule_yet', 'stopped_playing');--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_subject" text NOT NULL,
	"email" text,
	"name" text,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_change_events" (
	"id" text PRIMARY KEY NOT NULL,
	"movie_id" text NOT NULL,
	"location_id" text NOT NULL,
	"previous_status" "movie_availability_status",
	"new_status" "movie_availability_status" NOT NULL,
	"previous_theatre_count" integer,
	"new_theatre_count" integer NOT NULL,
	"previous_next_showing_at" timestamp,
	"new_next_showing_at" timestamp,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movie_local_status" (
	"movie_id" text NOT NULL,
	"location_id" text NOT NULL,
	"status" "movie_availability_status" NOT NULL,
	"next_showing_at" timestamp,
	"first_showing_at" timestamp,
	"last_showing_at" timestamp,
	"theatre_count" integer DEFAULT 0 NOT NULL,
	"last_seen_in_provider_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movie_local_status_pk" PRIMARY KEY("movie_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "user_movie_follows" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"movie_id" text NOT NULL,
	"location_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_saved_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"location_id" text NOT NULL,
	"label" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "showtimes_provider_theatre_movie_start_unique";--> statement-breakpoint
DROP INDEX "showtimes_movie_date_idx";--> statement-breakpoint
DROP INDEX "showtimes_theatre_date_idx";--> statement-breakpoint
ALTER TABLE "showtimes" ADD COLUMN "location_id" text;--> statement-breakpoint
ALTER TABLE "availability_change_events" ADD CONSTRAINT "availability_change_events_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_change_events" ADD CONSTRAINT "availability_change_events_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_local_status" ADD CONSTRAINT "movie_local_status_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_local_status" ADD CONSTRAINT "movie_local_status_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_movie_follows" ADD CONSTRAINT "user_movie_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_movie_follows" ADD CONSTRAINT "user_movie_follows_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_movie_follows" ADD CONSTRAINT "user_movie_follows_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saved_locations" ADD CONSTRAINT "user_saved_locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saved_locations" ADD CONSTRAINT "user_saved_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_subject_unique" ON "users" USING btree ("auth_subject");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "availability_change_events_location_changed_at_idx" ON "availability_change_events" USING btree ("location_id","changed_at");--> statement-breakpoint
CREATE INDEX "availability_change_events_movie_changed_at_idx" ON "availability_change_events" USING btree ("movie_id","changed_at");--> statement-breakpoint
CREATE INDEX "movie_local_status_location_status_idx" ON "movie_local_status" USING btree ("location_id","status");--> statement-breakpoint
CREATE INDEX "movie_local_status_location_next_showing_idx" ON "movie_local_status" USING btree ("location_id","next_showing_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_movie_follows_user_movie_location_unique" ON "user_movie_follows" USING btree ("user_id","movie_id","location_id");--> statement-breakpoint
CREATE INDEX "user_movie_follows_user_location_idx" ON "user_movie_follows" USING btree ("user_id","location_id");--> statement-breakpoint
CREATE INDEX "user_movie_follows_movie_location_idx" ON "user_movie_follows" USING btree ("movie_id","location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_saved_locations_user_location_unique" ON "user_saved_locations" USING btree ("user_id","location_id");--> statement-breakpoint
CREATE INDEX "user_saved_locations_user_default_idx" ON "user_saved_locations" USING btree ("user_id","is_default");--> statement-breakpoint
ALTER TABLE "showtimes" ADD CONSTRAINT "showtimes_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "showtimes_provider_location_theatre_movie_start_unique" ON "showtimes" USING btree ("provider","location_id","theatre_id","movie_id","start_at_local");--> statement-breakpoint
CREATE INDEX "showtimes_movie_location_date_idx" ON "showtimes" USING btree ("movie_id","location_id","business_date");--> statement-breakpoint
CREATE INDEX "showtimes_theatre_location_date_idx" ON "showtimes" USING btree ("theatre_id","location_id","business_date");