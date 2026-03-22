DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'notification_channel'
      AND e.enumlabel = 'push'
  ) THEN
    ALTER TYPE "public"."notification_channel" ADD VALUE 'push';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_push_subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "endpoint" text NOT NULL,
  "expiration_time" bigint,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_notification_preferences"
  ADD COLUMN IF NOT EXISTS "push_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_notification_preferences"
  ADD COLUMN IF NOT EXISTS "theatre_count_increased_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_notification_preferences"
  ADD COLUMN IF NOT EXISTS "final_showing_soon_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'web_push_subscriptions_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "web_push_subscriptions"
      ADD CONSTRAINT "web_push_subscriptions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade
      ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "web_push_subscriptions_endpoint_unique"
  ON "web_push_subscriptions" USING btree ("endpoint");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_push_subscriptions_user_active_idx"
  ON "web_push_subscriptions" USING btree ("user_id", "is_active");
