import { beforeEach, describe, expect, it, vi } from "vitest";

const checkDb = vi.fn();
const getServerEnv = vi.fn();
const isEmailTransportConfigured = vi.fn();
const isPushConfigured = vi.fn();
const getOperationalSnapshot = vi.fn();
const getRedis = vi.fn();

vi.mock("@/db/client", () => ({
  checkDb: () => checkDb(),
}));

vi.mock("@/shared/infra/env", () => ({
  getServerEnv: () => getServerEnv(),
}));

vi.mock("@/modules/notifications/email", () => ({
  isEmailTransportConfigured: () => isEmailTransportConfigured(),
}));

vi.mock("@/modules/notifications/push", () => ({
  isPushConfigured: () => isPushConfigured(),
}));

vi.mock("@/modules/ops/server", () => ({
  getOperationalSnapshot: () => getOperationalSnapshot(),
}));

vi.mock("@/shared/infra/redis", () => ({
  getRedis: () => getRedis(),
}));

import { GET as healthGet } from "@/app/api/health/route";
import { GET as readyGet } from "@/app/api/ready/route";

describe("readiness and health routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkDb.mockResolvedValue(undefined);
    getServerEnv.mockReturnValue({
      AUTH_SECRET: "this-is-a-real-secret-value-for-tests",
      GRACENOTE_API_KEY: "gracenote-live-key",
      TMDB_READ_ACCESS_TOKEN: "tmdb-live-token",
      TMDB_API_KEY: undefined,
      WORKER_ENABLE_SCHEDULERS: "true",
    });
    isEmailTransportConfigured.mockReturnValue(false);
    isPushConfigured.mockReturnValue(false);
    getRedis.mockReturnValue({ ping: vi.fn().mockResolvedValue("PONG") });
    getOperationalSnapshot.mockResolvedValue({
      performance: {
        staleLocationCount: 0,
        queues: { sync: { waiting: 0 }, delivery: { waiting: 0 } },
        recentFailures: [],
      },
      growth: { dashboardViews: 3, searches: 1 },
      providerHealth: { totalSyncRuns7d: 4, succeededSyncRuns7d: 4, failedSyncRuns7d: 0 },
      workerHealth: { totalJobs7d: 5, succeededJobs7d: 5, failedJobs7d: 0 },
      costSignals: {
        notificationDeliveries30d: 6,
        sent30d: 5,
        failed30d: 0,
        skipped30d: 1,
        providerSyncRuns7d: 4,
      },
    });
  });

  it("returns the operational snapshot from /api/health", async () => {
    const response = await healthGet();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      service: "cinecue-web",
      checks: {
        operations: true,
      },
      operations: {
        performance: {
          staleLocationCount: 0,
        },
      },
    });
  });

  it("returns 200 from /api/ready when core dependencies and stale checks pass", async () => {
    const response = await readyGet();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      service: "cinecue-web",
      checks: {
        database: true,
        redis: true,
        authSecretConfigured: true,
        gracenoteConfigured: true,
        tmdbConfigured: true,
        smtpConfigured: false,
        pushConfigured: false,
        schedulersEnabled: true,
        staleLocationsUnderThreshold: true,
        staleLocationCount: 0,
      },
      operations: {
        performance: {
          staleLocationCount: 0,
        },
      },
    });
  });

  it("returns 503 from /api/ready when stale locations exceed the threshold", async () => {
    getOperationalSnapshot.mockResolvedValueOnce({
      performance: {
        staleLocationCount: 2,
        queues: { sync: { waiting: 0 }, delivery: { waiting: 0 } },
        recentFailures: [],
      },
      growth: { dashboardViews: 3, searches: 1 },
      providerHealth: { totalSyncRuns7d: 4, succeededSyncRuns7d: 4, failedSyncRuns7d: 0 },
      workerHealth: { totalJobs7d: 5, succeededJobs7d: 5, failedJobs7d: 0 },
      costSignals: {
        notificationDeliveries30d: 6,
        sent30d: 5,
        failed30d: 0,
        skipped30d: 1,
        providerSyncRuns7d: 4,
      },
    });

    const response = await readyGet();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      checks: {
        staleLocationsUnderThreshold: false,
        staleLocationCount: 2,
      },
    });
  });
});
