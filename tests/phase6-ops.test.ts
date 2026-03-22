import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.fn();
const getServerEnv = vi.fn();
const getPhase4OperationalSnapshot = vi.fn();
const getGrowthMetrics = vi.fn();

vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => getServerEnv(),
}));

vi.mock("@/lib/phase4/operations", () => ({
  getPhase4OperationalSnapshot: () => getPhase4OperationalSnapshot(),
}));

vi.mock("@/lib/phase6/analytics", () => ({
  getGrowthMetrics: (...args: unknown[]) => getGrowthMetrics(...args),
}));

import { getPhase6OperationalSnapshot } from "@/lib/phase6/ops";

function selectResult<T>(rows: T[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(rows),
    })),
  };
}

describe("phase 6 ops snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerEnv.mockReturnValue({ PHASE6_ANALYTICS_WINDOW_DAYS: 30 });
    getPhase4OperationalSnapshot.mockResolvedValue({
      staleLocationCount: 1,
      queues: { sync: { waiting: 0 }, notifications: { waiting: 0 } },
      recentFailures: [{ id: "run_1" }],
    });
    getGrowthMetrics.mockResolvedValue({ dashboardViews: 5, searches: 2 });
  });

  it("maps provider, worker, and delivery counts using phase 6 field names", async () => {
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

    await expect(getPhase6OperationalSnapshot()).resolves.toMatchObject({
      phase: 6,
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
