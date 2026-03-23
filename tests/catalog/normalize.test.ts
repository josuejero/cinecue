import { describe, expect, it } from "vitest";
import { normalizeReleaseDate, normalizeTitle } from "@/modules/catalog/normalize";

describe("catalog normalization", () => {
  it("normalizes titles conservatively", () => {
    expect(normalizeTitle("Spider-Man: No Way Home")).toBe("spider man no way home");
    expect(normalizeTitle("Halloween (2018)")).toBe("halloween 2018");
  });

  it("normalizes only full release dates", () => {
    expect(normalizeReleaseDate("2026-03-20")).toBe("2026-03-20");
    expect(normalizeReleaseDate("2025")).toBeNull();
    expect(normalizeReleaseDate("2025-02-30")).toBeNull();
  });
});
