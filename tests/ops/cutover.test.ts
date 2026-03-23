import { beforeEach, describe, expect, it, vi } from "vitest";

const queueInstances = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
const Queue = vi.fn(function QueueMock(name: string) {
  const legacyRuntimeLabel = (value: number) => `phase${value}`;
  const schedulersByQueue = new Map([
    [
      `${legacyRuntimeLabel(4)}-sync`,
      [
        { id: `${legacyRuntimeLabel(4)}:sync-active-locations`, key: "legacy-1" },
        { id: `${legacyRuntimeLabel(4)}:sync-future-releases`, key: "legacy-2" },
        { id: `${legacyRuntimeLabel(4)}:cleanup-${legacyRuntimeLabel(4)}-data`, key: "legacy-3" },
      ],
    ],
    [
      `${legacyRuntimeLabel(4)}-notifications`,
      [
        { id: `${legacyRuntimeLabel(4)}:send-email-notifications`, key: "legacy-4" },
        { id: `${legacyRuntimeLabel(5)}:send-push-notifications`, key: "legacy-5" },
      ],
    ],
  ]);

  const instance = {
    getJobCounts: vi.fn().mockResolvedValue({ active: 0, delayed: 1, waiting: 2 }),
    getJobSchedulers: vi.fn().mockResolvedValue(schedulersByQueue.get(name) ?? []),
    removeJobScheduler: vi.fn().mockResolvedValue(true),
    drain: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  queueInstances.set(name, instance);
  return instance;
});

const getServerEnv = vi.fn();
const getRedis = vi.fn();
const upsertWorkerSchedulers = vi.fn();
const enqueueActiveLocationSyncs = vi.fn();
const enqueueEmailNotificationProcessing = vi.fn();
const enqueuePushDeliveryProcessing = vi.fn();

vi.mock("bullmq", () => ({
  Queue,
}));

vi.mock("@/shared/infra/env", () => ({
  getServerEnv: () => getServerEnv(),
}));

vi.mock("@/shared/infra/redis", () => ({
  getBullmqConnection: () => ({ url: "redis://localhost:6379" }),
  getRedis: () => getRedis(),
}));

vi.mock("@/modules/availability/queues", () => ({
  upsertWorkerSchedulers: () => upsertWorkerSchedulers(),
  enqueueEmailNotificationProcessing: (...args: unknown[]) =>
    enqueueEmailNotificationProcessing(...args),
  enqueuePushDeliveryProcessing: (...args: unknown[]) => enqueuePushDeliveryProcessing(...args),
}));

vi.mock("@/modules/availability/jobs", () => ({
  enqueueActiveLocationSyncs: (...args: unknown[]) => enqueueActiveLocationSyncs(...args),
}));

function buildEnv() {
  return {
    NOTIFICATIONS_EMAIL_BATCH_SIZE: 200,
    NOTIFICATIONS_PUSH_BATCH_SIZE: 100,
  };
}

describe("runtime id cutover", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    queueInstances.clear();
    getServerEnv.mockReturnValue(buildEnv());
    upsertWorkerSchedulers.mockResolvedValue({ enabled: true, schedulers: ["availability:sync-active-locations"] });
    enqueueActiveLocationSyncs.mockResolvedValue({ enqueued: 3, locationIds: ["loc_1", "loc_2", "loc_3"] });
    enqueueEmailNotificationProcessing.mockResolvedValue({
      id: "job_email",
      name: "send-email-notifications",
      queueName: "notifications-delivery",
    });
    enqueuePushDeliveryProcessing.mockResolvedValue({
      id: "job_push",
      name: "send-push-notifications",
      queueName: "notifications-delivery",
    });

    const legacyRuntimeLabel = (value: number) => `phase${value}`;
    const legacyCacheKey = `${legacyRuntimeLabel(6)}:dashboard-cache:user:user_1`;
    getRedis.mockReturnValue({
      scan: vi
        .fn()
        .mockResolvedValueOnce(["1", [legacyCacheKey]])
        .mockResolvedValueOnce(["0", []]),
      del: vi.fn().mockResolvedValue(1),
    });
  });

  it("reports legacy work without mutating anything during a dry run", async () => {
    const cutover = await import("@/modules/ops/cutover");
    const summary = await cutover.runRuntimeIdCutover({ dryRun: true });

    expect(summary).toMatchObject({
      dryRun: true,
      dashboardCache: {
        keysMatched: 1,
      },
    });
    expect(upsertWorkerSchedulers).not.toHaveBeenCalled();
    expect(enqueueActiveLocationSyncs).not.toHaveBeenCalled();
    expect(getRedis().del).not.toHaveBeenCalled();

    for (const instance of queueInstances.values()) {
      expect(instance.removeJobScheduler).not.toHaveBeenCalled();
      expect(instance.drain).not.toHaveBeenCalled();
      expect(instance.close).toHaveBeenCalled();
    }
  });

  it("removes legacy schedulers, clears old cache keys, and re-enqueues fresh work", async () => {
    const cutover = await import("@/modules/ops/cutover");
    const summary = await cutover.runRuntimeIdCutover();

    expect(summary).toMatchObject({
      dryRun: false,
      dashboardCache: {
        keysMatched: 1,
        deletedKeys: 1,
      },
      currentRuntime: {
        schedulers: {
          enabled: true,
        },
        reenqueue: {
          activeLocationSyncs: {
            enqueued: 3,
          },
          email: {
            id: "job_email",
            queueName: "notifications-delivery",
          },
          push: {
            id: "job_push",
            queueName: "notifications-delivery",
          },
        },
      },
    });

    expect(upsertWorkerSchedulers).toHaveBeenCalledOnce();
    expect(enqueueActiveLocationSyncs).toHaveBeenCalledOnce();
    expect(enqueueEmailNotificationProcessing).toHaveBeenCalledWith({
      reason: "cutover-runtime-ids",
      limit: 200,
    });
    expect(enqueuePushDeliveryProcessing).toHaveBeenCalledWith({
      reason: "cutover-runtime-ids",
      limit: 100,
    });
    expect(getRedis().del).toHaveBeenCalledWith(expect.stringContaining("dashboard-cache"));

    for (const instance of queueInstances.values()) {
      expect(instance.drain).toHaveBeenCalledWith(true);
      expect(instance.close).toHaveBeenCalled();
    }
  });
});
