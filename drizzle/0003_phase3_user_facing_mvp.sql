CREATE TYPE "public"."notification_channel" AS ENUM('email');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"delivery_key" text NOT NULL,
	"channel" "notification_channel" DEFAULT 'email' NOT NULL,
	"user_id" text NOT NULL,
	"location_id" text NOT NULL,
	"movie_id" text NOT NULL,
	"availability_change_event_id" text NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"provider_message_id" text,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"newly_scheduled_enabled" boolean DEFAULT true NOT NULL,
	"now_playing_enabled" boolean DEFAULT true NOT NULL,
	"advance_tickets_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_availability_change_event_id_availability_change_events_id_fk" FOREIGN KEY ("availability_change_event_id") REFERENCES "public"."availability_change_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_deliveries_delivery_key_unique" ON "notification_deliveries" USING btree ("delivery_key");--> statement-breakpoint
CREATE INDEX "notification_deliveries_user_status_idx" ON "notification_deliveries" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "notification_deliveries_event_idx" ON "notification_deliveries" USING btree ("availability_change_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_notification_preferences_user_id_unique" ON "user_notification_preferences" USING btree ("user_id");