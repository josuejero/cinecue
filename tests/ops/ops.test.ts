import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.fn();
const getServerEnv = vi.fn();
const getWorkerOperationalSnapshot = vi.fn();
const getGrowthMetrics = vi.fn();

vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
}));

vi.mock("@/shared/infra/env", () => ({
  getServerEnv: () => getServerEnv(),
}));

vi.mock("@/modules/ops/worker-runtime", () => ({
  getWorkerOperationalSnapshot: () => getWorkerOperationalSnapshot(),
}));

vi.mock("@/modules/analytics/server", () => ({
  getGrowthMetrics: (...args: unknown[]) => getGrowthMetrics(...args),
}));

import { getOperationalSnapshot } from "@/modules/ops/server";

function selectResult<T>(rows: T[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(rows),
    })),
  };
}

describe("operations snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerEnv.mockReturnValue({ ANALYTICS_WINDOW_DAYS: 30 });
    getWorkerOperationalSnapshot.mockResolvedValue({
      staleLocationCount: 1,
      queues: { sync: { waiting: 0 }, delivery: { waiting: 0 } },
      recentFailures: [{ id: "run_1" }],
    });
    getGrowthMetrics.mockResolvedValue({ dashboardViews: 5, searches: 2 });
  });

  it("maps provider, worker, and delivery counts into the ops snapshot", async () => {
    getDb.mockReturnValue({
      select: vi
        .fn()
        .mockReturnValueOnce(
          selectResult([
            { totalSyncRuns7d: 10, succeededSyncRuns7d: 9, failedSyncRuns7d: 1 },
          ]),
        )
        .mockReturnValueOnce(
          selectResult([{ totalJobs7d: 8, succeededJobs7d: 7, failedJobs7d: 1 }]),
        )
        .mockReturnValueOnce(
          selectResult([{ totalDeliveries30d: 20, sent30d: 17, failed30d: 2, skipped30d: 1 }]),
        ),
    });

    await expect(getOperationalSnapshot()).resolves.toMatchObject({
      growth: { dashboardViews: 5, searches: 2 },
      providerHealth: {
        totalSyncRuns7d: 10,
        succeededSyncRuns7d: 9,
        failedSyncRuns7d: 1,
      },
      workerHealth: {
        totalJobs7d: 8,
        succeededJobs7d: 7,
        failedJobs7d: 1,
      },
      costSignals: {
        notificationDeliveries30d: 20,
        sent30d: 17,
        failed30d: 2,
        skipped30d: 1,
        providerSyncRuns7d: 10,
      },
    });

    expect(getGrowthMetrics).toHaveBeenCalledWith(30);
  });
});
