import { describe, expect, it } from "vitest";
import { scoreMovieSearchCandidate } from "@/lib/phase6/search";

describe("phase 6 search scoring", () => {
  it("prefers exact title matches over prefix and contains matches", () => {
    const exact = scoreMovieSearchCandidate("the batman", "the batman", 2022);
    const startsWith = scoreMovieSearchCandidate("the batman begins", "the batman", 2005);
    const contains = scoreMovieSearchCandidate("lego the batman story", "the batman", 2017);

    expect(exact).toBeGreaterThan(startsWith);
    expect(startsWith).toBeGreaterThan(contains);
  });
});
