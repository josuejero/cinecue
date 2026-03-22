CREATE TABLE "product_analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"location_id" text,
	"movie_id" text,
	"session_id" text,
	"event_name" text NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_favorite_theatres" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"location_id" text NOT NULL,
	"theatre_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_saved_locations" ADD COLUMN "display_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_saved_locations" ADD COLUMN "distance_override_miles" integer;--> statement-breakpoint
ALTER TABLE "user_saved_locations" ADD COLUMN "last_used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_analytics_events" ADD CONSTRAINT "product_analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_analytics_events" ADD CONSTRAINT "product_analytics_events_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_analytics_events" ADD CONSTRAINT "product_analytics_events_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorite_theatres" ADD CONSTRAINT "user_favorite_theatres_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorite_theatres" ADD CONSTRAINT "user_favorite_theatres_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorite_theatres" ADD CONSTRAINT "user_favorite_theatres_theatre_id_theatres_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."theatres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_analytics_events_event_created_idx" ON "product_analytics_events" USING btree ("event_name","created_at");--> statement-breakpoint
CREATE INDEX "product_analytics_events_user_created_idx" ON "product_analytics_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "product_analytics_events_location_created_idx" ON "product_analytics_events" USING btree ("location_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_favorite_theatres_user_location_theatre_unique" ON "user_favorite_theatres" USING btree ("user_id","location_id","theatre_id");--> statement-breakpoint
CREATE INDEX "user_favorite_theatres_user_location_idx" ON "user_favorite_theatres" USING btree ("user_id","location_id");--> statement-breakpoint
CREATE INDEX "movie_local_status_location_status_next_idx" ON "movie_local_status" USING btree ("location_id","status","next_showing_at");--> statement-breakpoint
CREATE INDEX "showtimes_location_movie_start_idx" ON "showtimes" USING btree ("location_id","movie_id","start_at_local");--> statement-breakpoint
CREATE INDEX "showtimes_location_theatre_start_idx" ON "showtimes" USING btree ("location_id","theatre_id","start_at_local");--> statement-breakpoint
CREATE INDEX "user_saved_locations_user_display_order_idx" ON "user_saved_locations" USING btree ("user_id","is_default","display_order","created_at");
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "movies_normalized_title_trgm_idx" ON "movies" USING gin ("normalized_title" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "theatres_normalized_name_trgm_idx" ON "theatres" USING gin ("normalized_name" gin_trgm_ops);
