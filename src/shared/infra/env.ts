import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),

  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.enum(["true", "false"]).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().min(1).optional(),

  GRACENOTE_BASE_URL: z.string().url().default("http://data.tmsapi.com/v1.1"),
  GRACENOTE_API_KEY: z.string().min(1).optional(),
  GRACENOTE_MEDIA_CLOUD_BASE_URL: z.string().url().default("https://developer.tmsimg.com"),

  TMDB_BASE_URL: z.string().url().default("https://api.themoviedb.org/3"),
  TMDB_READ_ACCESS_TOKEN: z.string().min(1).optional(),
  TMDB_API_KEY: z.string().min(1).optional(),

  AVAILABILITY_TEST_ZIP: z.string().optional(),

  WORKER_ENABLE_SCHEDULERS: z.enum(["true", "false"]).default("true"),
  AVAILABILITY_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(15),
  AVAILABILITY_SYNC_NUM_DAYS: z.coerce.number().int().positive().default(14),
  AVAILABILITY_ACTIVE_LOCATION_LIMIT: z.coerce.number().int().positive().default(200),
  WORKER_LOCATION_SYNC_CONCURRENCY: z.coerce.number().int().positive().default(6),
  NOTIFICATIONS_EMAIL_INTERVAL_MINUTES: z.coerce.number().int().positive().default(10),
  NOTIFICATIONS_EMAIL_BATCH_SIZE: z.coerce.number().int().positive().default(200),
  CATALOG_FUTURE_RELEASES_INTERVAL_MINUTES: z.coerce.number().int().positive().default(360),
  CATALOG_FUTURE_RELEASES_NUM_DAYS: z.coerce.number().int().positive().default(60),
  AVAILABILITY_SHOWTIME_RETENTION_DAYS: z.coerce.number().int().positive().default(21),
  WORKER_JOB_RUN_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  AVAILABILITY_STALE_AFTER_MINUTES: z.coerce.number().int().positive().default(90),
  AVAILABILITY_FINAL_SHOWING_SOON_HOURS: z.coerce.number().int().positive().default(24),
  AVAILABILITY_SYNC_COUNTRY: z.enum(["USA", "CAN"]).default("USA"),

  WEB_PUSH_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  WEB_PUSH_VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  WEB_PUSH_SUBJECT: z.string().min(1).optional(),

  NOTIFICATIONS_PUSH_INTERVAL_MINUTES: z.coerce.number().int().positive().default(1),
  NOTIFICATIONS_PUSH_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  AVAILABILITY_EVENTS_HEARTBEAT_MS: z.coerce.number().int().positive().default(15_000),
  AVAILABILITY_EVENTS_POLL_MS: z.coerce.number().int().positive().default(15_000),

  DASHBOARD_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30),
  ANALYTICS_WINDOW_DAYS: z.coerce.number().int().positive().default(30),
  CALENDAR_DEFAULT_DURATION_MINUTES: z.coerce.number().int().positive().default(150),
});

export function parseServerEnv(input: Record<string, string | undefined>) {
  return serverEnvSchema.parse(input);
}

let envLoaded = false;

function ensureEnvLoaded() {
  if (envLoaded) {
    return;
  }

  const projectRoot = process.cwd();
  const envPath = path.resolve(projectRoot, ".env");

  if (!fs.existsSync(envPath)) {
    throw new Error(
      ".env missing; copy .env.example to .env and replace the placeholder values with real credentials before running the app.",
    );
  }

  dotenv.config({ path: envPath });
  envLoaded = true;
}

export function getServerEnv() {
  ensureEnvLoaded();
  return parseServerEnv(process.env);
}
