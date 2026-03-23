import { beforeEach, describe, expect, it, vi } from "vitest";

const queueInstances = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
const Queue = vi.fn(function QueueMock(name: string) {
  const instance = {
    upsertJobScheduler: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  queueInstances.set(name, instance);
  return instance;
});

const getServerEnv = vi.fn();

vi.mock("bullmq", () => ({
  Queue,
}));

vi.mock("@/shared/infra/env", () => ({
  getServerEnv: () => getServerEnv(),
}));

vi.mock("@/shared/infra/redis", () => ({
  getBullmqConnection: () => ({ url: "redis://localhost:6379" }),
}));

function buildEnv(overrides?: Record<string, unknown>) {
  return {
    WORKER_ENABLE_SCHEDULERS: "true",
    AVAILABILITY_SYNC_INTERVAL_MINUTES: 15,
    AVAILABILITY_ACTIVE_LOCATION_LIMIT: 200,
    NOTIFICATIONS_EMAIL_INTERVAL_MINUTES: 10,
    NOTIFICATIONS_EMAIL_BATCH_SIZE: 200,
    NOTIFICATIONS_PUSH_INTERVAL_MINUTES: 1,
    NOTIFICATIONS_PUSH_BATCH_SIZE: 100,
    CATALOG_FUTURE_RELEASES_INTERVAL_MINUTES: 360,
    CATALOG_FUTURE_RELEASES_NUM_DAYS: 60,
    AVAILABILITY_SYNC_COUNTRY: "USA",
    AVAILABILITY_SHOWTIME_RETENTION_DAYS: 21,
    WORKER_JOB_RUN_RETENTION_DAYS: 30,
    ...overrides,
  };
}

describe("availability queues", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    queueInstances.clear();
    delete (globalThis as typeof globalThis & {
      __cinecueAvailabilitySyncQueue?: unknown;
      __cinecueNotificationsDeliveryQueue?: unknown;
    }).__cinecueAvailabilitySyncQueue;
    delete (globalThis as typeof globalThis & {
      __cinecueAvailabilitySyncQueue?: unknown;
      __cinecueNotificationsDeliveryQueue?: unknown;
    }).__cinecueNotificationsDeliveryQueue;
    getServerEnv.mockReturnValue(buildEnv());
  });

  it("uses the renamed queue names and scheduler ids", async () => {
    const queues = await import("@/modules/availability/queues");

    await expect(queues.upsertWorkerSchedulers()).resolves.toEqual({
      enabled: true,
      schedulers: [
        "availability:sync-active-locations",
        "notifications:send-email",
        "notifications:send-push",
        "catalog:sync-future-releases",
        "ops:cleanup-runtime-data",
      ],
    });

    expect(Queue).toHaveBeenCalledWith(
      queues.AVAILABILITY_SYNC_QUEUE,
      expect.objectContaining({
        connection: { url: "redis://localhost:6379" },
      }),
    );
    expect(Queue).toHaveBeenCalledWith(
      queues.NOTIFICATIONS_DELIVERY_QUEUE,
      expect.objectContaining({
        connection: { url: "redis://localhost:6379" },
      }),
    );

    const syncQueue = queueInstances.get(queues.AVAILABILITY_SYNC_QUEUE);
    const deliveryQueue = queueInstances.get(queues.NOTIFICATIONS_DELIVERY_QUEUE);

    expect(syncQueue?.upsertJobScheduler).toHaveBeenCalledWith(
      "availability:sync-active-locations",
      { every: 15 * 60_000 },
      expect.objectContaining({
        name: "sync-active-locations",
        data: { limit: 200 },
      }),
    );
    expect(syncQueue?.upsertJobScheduler).toHaveBeenCalledWith(
      "catalog:sync-future-releases",
      { every: 360 * 60_000 },
      expect.objectContaining({
        name: "sync-future-releases",
        data: { numDays: 60, country: "USA" },
      }),
    );
    expect(syncQueue?.upsertJobScheduler).toHaveBeenCalledWith(
      "ops:cleanup-runtime-data",
      { pattern: "0 30 3 * * *" },
      expect.objectContaining({
        name: "cleanup-runtime-data",
        data: { showtimeRetentionDays: 21, jobRunRetentionDays: 30 },
      }),
    );
    expect(deliveryQueue?.upsertJobScheduler).toHaveBeenCalledWith(
      "notifications:send-email",
      { every: 10 * 60_000 },
      expect.objectContaining({
        name: "send-email-notifications",
        data: { limit: 200 },
      }),
    );
    expect(deliveryQueue?.upsertJobScheduler).toHaveBeenCalledWith(
      "notifications:send-push",
      { every: 60_000 },
      expect.objectContaining({
        name: "send-push-notifications",
        data: { limit: 100 },
      }),
    );
  });

  it("skips scheduler creation when schedulers are disabled", async () => {
    getServerEnv.mockReturnValue(buildEnv({ WORKER_ENABLE_SCHEDULERS: "false" }));
    const queues = await import("@/modules/availability/queues");

    await expect(queues.upsertWorkerSchedulers()).resolves.toEqual({
      enabled: false,
      schedulers: [],
    });
    expect(Queue).not.toHaveBeenCalled();
  });
});
