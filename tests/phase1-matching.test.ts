import { chooseBestCandidate, titleSimilarity } from "@/lib/matching";
import { describe, expect, it } from "vitest";

describe("movie matching", () => {
  it("matches exact title and year", () => {
    const result = chooseBestCandidate(
      {
        normalizedTitle: "mission impossible the final reckoning",
        releaseYear: 2026,
      },
      [
        {
          id: "movie_1",
          normalizedTitle: "mission impossible the final reckoning",
          releaseYear: 2026,
        },
      ],
    );

    expect(result.kind).toBe("matched");
    if (result.kind === "matched") {
      expect(result.movieId).toBe("movie_1");
      expect(result.matchedBy).toBe("title_year_exact");
      expect(result.confidence).toBe("high");
    }
  });

  it("flags ambiguous exact-title matches as conflicts", () => {
    const result = chooseBestCandidate(
      {
        normalizedTitle: "halloween",
        releaseYear: null,
      },
      [
        { id: "movie_1", normalizedTitle: "halloween", releaseYear: 1978 },
        { id: "movie_2", normalizedTitle: "halloween", releaseYear: 2018 },
      ],
    );

    expect(result.kind).toBe("conflict");
  });

  it("allows fuzzy matches when one candidate clearly wins", () => {
    const result = chooseBestCandidate(
      {
        normalizedTitle: "spider man no way home",
        releaseYear: 2021,
      },
      [
        {
          id: "movie_1",
          normalizedTitle: "spiderman no way home",
          releaseYear: 2021,
        },
        {
          id: "movie_2",
          normalizedTitle: "spider man homecoming",
          releaseYear: 2017,
        },
      ],
    );

    expect(result.kind).toBe("matched");
  });

  it("computes similarity scores on normalized titles", () => {
    expect(titleSimilarity("spider man no way home", "spiderman no way home")).toBeGreaterThan(
      0.86,
    );
  });
});