import {
  businessDateFromIso,
  normalizePostalCode,
  normalizeReleaseDate,
  normalizeTheatreIdentityKey,
  normalizeTitle,
  runtimeIsoToMinutes,
} from "@/lib/normalize";
import { describe, expect, it } from "vitest";

describe("normalize helpers", () => {
  it("normalizes titles conservatively", () => {
    expect(normalizeTitle("Spider-Man: No Way Home")).toBe("spider man no way home");
    expect(normalizeTitle("Halloween (2018)")).toBe("halloween 2018");
  });

  it("normalizes postal codes", () => {
    expect(normalizePostalCode("10001")).toBe("10001");
    expect(normalizePostalCode("m5v 3l9")).toBe("M5V3L9");
  });

  it("builds theatre identity keys", () => {
    expect(
      normalizeTheatreIdentityKey({
        name: "AMC Empire 25",
        address1: "234 W 42nd St",
        address2: null,
        city: "New York",
        state: "NY",
        postalCode: "10036",
        countryCode: "USA",
      }),
    ).toBe("amc empire 25|234 w 42nd st new york ny 10036|10036|USA");
  });

  it("parses runtime ISO strings", () => {
    expect(runtimeIsoToMinutes("PT01H35M")).toBe(95);
    expect(runtimeIsoToMinutes("PT2H")).toBe(120);
    expect(runtimeIsoToMinutes(undefined)).toBeNull();
  });

  it("extracts business date from local date-time strings", () => {
    expect(businessDateFromIso("2026-03-20T19:30")).toBe("2026-03-20");
  });

  it("normalizes only full release dates", () => {
    expect(normalizeReleaseDate("2026-03-20")).toBe("2026-03-20");
    expect(normalizeReleaseDate("2025")).toBeNull();
    expect(normalizeReleaseDate("2025-02-30")).toBeNull();
  });
});
