import { describe, expect, it } from "vitest";
import { TooManyRequestsError, jsonFromError } from "@/shared/http/errors";

describe("jsonFromError", () => {
  it("maps TooManyRequestsError to 429 with Retry-After", async () => {
    const response = jsonFromError(new TooManyRequestsError("Slow down.", 42));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    await expect(response.json()).resolves.toEqual({ error: "Slow down." });
  });
});
