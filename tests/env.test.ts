import { parseServerEnv } from "@/lib/env";
import { describe, expect, it } from "vitest";

describe("parseServerEnv", () => {
  it("accepts the minimum phase 0 env contract", () => {
    const env = parseServerEnv({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://cinecue:cinecue@localhost:5432/cinecue",
      REDIS_URL: "redis://localhost:6379",
      AUTH_SECRET: "4e6fe46903332bfb8f7fae9f2d52dbe3",
    });

    expect(env.NODE_ENV).toBe("development");
    expect(env.DATABASE_URL).toContain("cinecue");
  });
});