import { beforeEach, describe, expect, it, vi } from "vitest";

const getRedis = vi.fn();

vi.mock("@/shared/infra/redis", () => ({
  getRedis: () => getRedis(),
}));

import { TooManyRequestsError } from "@/shared/http/errors";
import { assertRateLimit } from "@/shared/infra/rate-limit";

describe("assertRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(125_000);
  });

  it("uses the client IP by default and lets an explicit subject override it", async () => {
    const incr = vi.fn().mockResolvedValue(1);
    const expire = vi.fn().mockResolvedValue(1);
    getRedis.mockReturnValue({ incr, expire });

    const request = new Request("http://localhost/api/dashboard", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 198.51.100.2",
      },
    });

    await assertRateLimit({
      request,
      scope: "dashboard",
      limit: 2,
      windowSeconds: 60,
    });
    const ipKey = incr.mock.calls[0][0] as string;

    incr.mockClear();
    expire.mockClear();

    await assertRateLimit({
      request,
      scope: "dashboard",
      subject: " user_1 ",
      limit: 2,
      windowSeconds: 60,
    });
    const subjectKey = incr.mock.calls[0][0] as string;

    expect(ipKey).toMatch(/^rate:dashboard:/);
    expect(subjectKey).toMatch(/^rate:dashboard:/);
    expect(subjectKey).not.toBe(ipKey);
    expect(expire).toHaveBeenCalledWith(subjectKey, 65);
  });

  it("throws TooManyRequestsError with a retry-after derived from the window", async () => {
    const incr = vi.fn().mockResolvedValue(3);
    const expire = vi.fn().mockResolvedValue(1);
    getRedis.mockReturnValue({ incr, expire });

    let thrown: unknown;
    try {
      await assertRateLimit({
        request: new Request("http://localhost/api/dashboard"),
        scope: "dashboard",
        subject: "user_1",
        limit: 2,
        windowSeconds: 60,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(TooManyRequestsError);
    expect((thrown as TooManyRequestsError).retryAfterSeconds).toBe(55);
  });
});
