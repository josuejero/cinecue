import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/shared/infra/env";

describe("parseServerEnv", () => {
  it("accepts the minimum worker and availability env contract", () => {
    const env = parseServerEnv({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://cinecue:cinecue@localhost:5432/cinecue",
      REDIS_URL: "redis://localhost:6379",
      AUTH_SECRET: "4e6fe46903332bfb8f7fae9f2d52dbe3",
    });

    expect(env.NODE_ENV).toBe("development");
    expect(env.DATABASE_URL).toContain("cinecue");
    expect(env.APP_BASE_URL).toBe("http://localhost:3000");
    expect(env.SMTP_HOST).toBeUndefined();
    expect(env.GRACENOTE_MEDIA_CLOUD_BASE_URL).toBe("https://developer.tmsimg.com");
    expect(env.WORKER_ENABLE_SCHEDULERS).toBe("true");
    expect(env.AVAILABILITY_SYNC_INTERVAL_MINUTES).toBe(15);
    expect(env.AVAILABILITY_SYNC_NUM_DAYS).toBe(14);
    expect(env.AVAILABILITY_ACTIVE_LOCATION_LIMIT).toBe(200);
    expect(env.WORKER_LOCATION_SYNC_CONCURRENCY).toBe(6);
    expect(env.NOTIFICATIONS_EMAIL_INTERVAL_MINUTES).toBe(10);
    expect(env.NOTIFICATIONS_EMAIL_BATCH_SIZE).toBe(200);
    expect(env.CATALOG_FUTURE_RELEASES_INTERVAL_MINUTES).toBe(360);
    expect(env.CATALOG_FUTURE_RELEASES_NUM_DAYS).toBe(60);
    expect(env.AVAILABILITY_SHOWTIME_RETENTION_DAYS).toBe(21);
    expect(env.WORKER_JOB_RUN_RETENTION_DAYS).toBe(30);
    expect(env.AVAILABILITY_STALE_AFTER_MINUTES).toBe(90);
    expect(env.AVAILABILITY_FINAL_SHOWING_SOON_HOURS).toBe(24);
    expect(env.AVAILABILITY_SYNC_COUNTRY).toBe("USA");
    expect(env.WEB_PUSH_VAPID_PUBLIC_KEY).toBeUndefined();
    expect(env.NOTIFICATIONS_PUSH_INTERVAL_MINUTES).toBe(1);
    expect(env.NOTIFICATIONS_PUSH_BATCH_SIZE).toBe(100);
    expect(env.AVAILABILITY_EVENTS_HEARTBEAT_MS).toBe(15_000);
    expect(env.AVAILABILITY_EVENTS_POLL_MS).toBe(15_000);
    expect(env.DASHBOARD_CACHE_TTL_SECONDS).toBe(30);
    expect(env.ANALYTICS_WINDOW_DAYS).toBe(30);
    expect(env.CALENDAR_DEFAULT_DURATION_MINUTES).toBe(150);
  });

  it("parses optional SMTP env vars when provided", () => {
    const env = parseServerEnv({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://cinecue:cinecue@localhost:5432/cinecue",
      REDIS_URL: "redis://localhost:6379",
      AUTH_SECRET: "4e6fe46903332bfb8f7fae9f2d52dbe3",
      APP_BASE_URL: "https://cinecue.example.com",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "user",
      SMTP_PASS: "pass",
      SMTP_FROM: "CineCue Alerts <alerts@example.com>",
    });

    expect(env.APP_BASE_URL).toBe("https://cinecue.example.com");
    expect(env.SMTP_HOST).toBe("smtp.example.com");
    expect(env.SMTP_PORT).toBe(587);
    expect(env.SMTP_SECURE).toBe("false");
  });
});
