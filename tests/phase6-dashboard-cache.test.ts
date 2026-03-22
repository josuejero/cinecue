import { beforeEach, describe, expect, it, vi } from "vitest";

const redis = {
  get: vi.fn(),
  smembers: vi.fn(),
  del: vi.fn(),
  multi: vi.fn(),
};

const getServerEnv = vi.fn();

vi.mock("@/lib/redis", () => ({
  getRedis: () => redis,
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => getServerEnv(),
}));

import {
  invalidateDashboardCacheForUser,
  readDashboardCache,
  writeDashboardCache,
} from "@/lib/phase6/dashboard-cache";

describe("phase 6 dashboard cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerEnv.mockReturnValue({ PHASE6_DASHBOARD_CACHE_TTL_SECONDS: 30 });
  });

  it("reads cached payloads from redis", async () => {
    redis.get.mockResolvedValueOnce(JSON.stringify({ totalFollows: 3 }));

    await expect(readDashboardCache("user_1", "location:loc_1")).resolves.toEqual({
      totalFollows: 3,
    });
  });

  it("writes scoped cache entries and tracks them by user", async () => {
    const exec = vi.fn().mockResolvedValue(undefined);
    const expire = vi.fn(() => ({ exec }));
    const sadd = vi.fn(() => ({ expire }));
    const set = vi.fn(() => ({ sadd }));
    redis.multi.mockReturnValueOnce({ set });

    await writeDashboardCache("user_1", "location:loc_1", { totalFollows: 2 });

    expect(set).toHaveBeenCalledWith(
      "phase6:dashboard-cache:user:user_1:location:loc_1",
      JSON.stringify({ totalFollows: 2 }),
      "EX",
      30,
    );
    expect(sadd).toHaveBeenCalledWith(
      "phase6:dashboard-cache:user:user_1",
      "phase6:dashboard-cache:user:user_1:location:loc_1",
    );
    expect(expire).toHaveBeenCalledWith("phase6:dashboard-cache:user:user_1", 30);
    expect(exec).toHaveBeenCalled();
  });

  it("invalidates all user-scoped cache keys", async () => {
    redis.smembers.mockResolvedValueOnce([
      "phase6:dashboard-cache:user:user_1:location:loc_1",
      "phase6:dashboard-cache:user:user_1:location:loc_2",
    ]);
    redis.del.mockResolvedValueOnce(3);

    await expect(invalidateDashboardCacheForUser("user_1")).resolves.toBe(2);
    expect(redis.del).toHaveBeenCalledWith(
      "phase6:dashboard-cache:user:user_1",
      "phase6:dashboard-cache:user:user_1:location:loc_1",
      "phase6:dashboard-cache:user:user_1:location:loc_2",
    );
  });
});
