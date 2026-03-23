import { describe, expect, it } from "vitest";
import { normalizePostalCode } from "@/modules/locations/normalize";

describe("location normalization", () => {
  it("normalizes postal codes", () => {
    expect(normalizePostalCode("10001")).toBe("10001");
    expect(normalizePostalCode("m5v 3l9")).toBe("M5V3L9");
  });
});
