import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { productAnalyticsEvents } from "@/db/schema";
import { hasPostgresErrorCode } from "@/shared/infra/db-error-utils";

function createId() {
  return crypto.randomUUID();
}

let ensureProductAnalyticsEventsTablePromise: Promise<void> | null = null;

async function ensureProductAnalyticsEventsTable() {
  if (!ensureProductAnalyticsEventsTablePromise) {
    ensureProductAnalyticsEventsTablePromise = (async () => {
      const db = getDb();
      const tableStatement = sql`
        CREATE TABLE IF NOT EXISTS "product_analytics_events" (
          "id" text PRIMARY KEY NOT NULL,
          "user_id" text,
          "location_id" text,
          "movie_id" text,
          "session_id" text,
          "event_name" text NOT NULL,
          "properties" jsonb NOT NULL DEFAULT '{}'::jsonb,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL
        )
      `;
      const constraintStatements = [
        sql`
          ALTER TABLE "product_analytics_events"
          ADD CONSTRAINT "product_analytics_events_user_id_users_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
        `,
        sql`
          ALTER TABLE "product_analytics_events"
          ADD CONSTRAINT "product_analytics_events_location_id_locations_id_fk"
          FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action
        `,
        sql`
          ALTER TABLE "product_analytics_events"
          ADD CONSTRAINT "product_analytics_events_movie_id_movies_id_fk"
          FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE set null ON UPDATE no action
        `,
      ];
      const indexStatements = [
        sql`
          CREATE INDEX IF NOT EXISTS "product_analytics_events_event_created_idx"
          ON "product_analytics_events" USING btree ("event_name","created_at")
        `,
        sql`
          CREATE INDEX IF NOT EXISTS "product_analytics_events_user_created_idx"
          ON "product_analytics_events" USING btree ("user_id","created_at")
        `,
        sql`
          CREATE INDEX IF NOT EXISTS "product_analytics_events_location_created_idx"
          ON "product_analytics_events" USING btree ("location_id","created_at")
        `,
      ];

      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await db.execute(tableStatement);
          for (const statement of constraintStatements) {
            try {
              await db.execute(statement);
            } catch (error) {
              if (!hasPostgresErrorCode(error, "42710")) {
                throw error;
              }
            }
          }
          for (const statement of indexStatements) {
            await db.execute(statement);
          }
          return;
        } catch (error) {
          if (attempt === maxAttempts) {
            throw error;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    })();
  }

  try {
    await ensureProductAnalyticsEventsTablePromise;
  } catch (error) {
    ensureProductAnalyticsEventsTablePromise = null;
    throw error;
  }
}

export type ProductEventName =
  | "dashboard_view"
  | "search"
  | "follow"
  | "unfollow"
  | "location_saved"
  | "location_default_changed"
  | "favorite_theatre_added"
  | "favorite_theatre_removed"
  | "calendar_export";

export async function trackProductEvent(input: {
  userId?: string | null;
  locationId?: string | null;
  movieId?: string | null;
  sessionId?: string | null;
  eventName: ProductEventName;
  properties?: Record<string, unknown>;
}) {
  await ensureProductAnalyticsEventsTable();
  const db = getDb();

  await db.insert(productAnalyticsEvents).values({
    id: createId(),
    userId: input.userId ?? null,
    locationId: input.locationId ?? null,
    movieId: input.movieId ?? null,
    sessionId: input.sessionId ?? null,
    eventName: input.eventName,
    properties: input.properties ?? {},
    createdAt: new Date(),
  });
}

export async function getGrowthMetrics(windowDays = 30) {
  await ensureProductAnalyticsEventsTable();
  const db = getDb();

  const [row] = await db
    .select({
      dashboardViews: sql<number>`count(*) filter (where ${productAnalyticsEvents.eventName} = 'dashboard_view')`,
      searches: sql<number>`count(*) filter (where ${productAnalyticsEvents.eventName} = 'search')`,
      follows: sql<number>`count(*) filter (where ${productAnalyticsEvents.eventName} = 'follow')`,
      unfollows: sql<number>`count(*) filter (where ${productAnalyticsEvents.eventName} = 'unfollow')`,
      locationSaves: sql<number>`count(*) filter (where ${productAnalyticsEvents.eventName} = 'location_saved')`,
      favoriteAdds: sql<number>`count(*) filter (where ${productAnalyticsEvents.eventName} = 'favorite_theatre_added')`,
      favoriteRemoves: sql<number>`count(*) filter (where ${productAnalyticsEvents.eventName} = 'favorite_theatre_removed')`,
      calendarExports: sql<number>`count(*) filter (where ${productAnalyticsEvents.eventName} = 'calendar_export')`,
      uniqueUsers: sql<number>`count(distinct ${productAnalyticsEvents.userId})`,
    })
    .from(productAnalyticsEvents)
    .where(
      sql`${productAnalyticsEvents.createdAt} >= now() - (${windowDays} || ' days')::interval`,
    );

  const searches = Number(row?.searches ?? 0);
  const follows = Number(row?.follows ?? 0);

  return {
    windowDays,
    dashboardViews: Number(row?.dashboardViews ?? 0),
    searches,
    follows,
    unfollows: Number(row?.unfollows ?? 0),
    locationSaves: Number(row?.locationSaves ?? 0),
    favoriteAdds: Number(row?.favoriteAdds ?? 0),
    favoriteRemoves: Number(row?.favoriteRemoves ?? 0),
    calendarExports: Number(row?.calendarExports ?? 0),
    uniqueUsers: Number(row?.uniqueUsers ?? 0),
    searchToFollowConversion: searches > 0 ? follows / searches : 0,
  };
}
