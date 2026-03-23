import { describe, expect, it } from "vitest";
import {
  businessDateFromIso,
  runtimeIsoToMinutes,
} from "@/modules/availability/normalize";

describe("availability normalization", () => {
  it("parses runtime ISO strings", () => {
    expect(runtimeIsoToMinutes("PT01H35M")).toBe(95);
    expect(runtimeIsoToMinutes("PT2H")).toBe(120);
    expect(runtimeIsoToMinutes(undefined)).toBeNull();
  });

  it("extracts business dates from local date-time strings", () => {
    expect(businessDateFromIso("2026-03-20T19:30")).toBe("2026-03-20");
  });
});
