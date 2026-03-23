export interface CandidateMovieRecord {
  id: string;
  normalizedTitle: string;
  releaseYear: number | null;
}

export interface IncomingMovieRecord {
  normalizedTitle: string;
  releaseYear: number | null;
}

export type MovieMatchResult =
  | {
      kind: "matched";
      movieId: string;
      matchedBy: "title_year_exact" | "title_exact" | "title_year_fuzzy";
      confidence: "high" | "medium";
    }
  | {
      kind: "conflict";
      reason: string;
      candidateMovieIds: string[];
    }
  | {
      kind: "new";
    };

function yearsCompatible(
  left: number | null,
  right: number | null,
  tolerance: number,
) {
  if (left == null || right == null) {
    return true;
  }

  return Math.abs(left - right) <= tolerance;
}

function bigrams(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length < 2) {
    return new Set([compact]);
  }

  const grams = new Set<string>();
  for (let i = 0; i < compact.length - 1; i += 1) {
    grams.add(compact.slice(i, i + 2));
  }

  return grams;
}

export function titleSimilarity(left: string, right: string) {
  const a = bigrams(left);
  const b = bigrams(right);

  const intersection = [...a].filter((item) => b.has(item)).length;
  const union = new Set([...a, ...b]).size;

  return union === 0 ? 0 : intersection / union;
}

export function chooseBestCandidate(
  incoming: IncomingMovieRecord,
  candidates: CandidateMovieRecord[],
): MovieMatchResult {
  if (candidates.length === 0) {
    return { kind: "new" };
  }

  const exactTitleAndYear = candidates.filter(
    (candidate) =>
      candidate.normalizedTitle === incoming.normalizedTitle &&
      yearsCompatible(candidate.releaseYear, incoming.releaseYear, 0),
  );

  if (exactTitleAndYear.length === 1) {
    return {
      kind: "matched",
      movieId: exactTitleAndYear[0].id,
      matchedBy: "title_year_exact",
      confidence: "high",
    };
  }

  if (exactTitleAndYear.length > 1) {
    return {
      kind: "conflict",
      reason: "Multiple exact title/year matches exist.",
      candidateMovieIds: exactTitleAndYear.map((candidate) => candidate.id),
    };
  }

  const exactTitleOnly = candidates.filter(
    (candidate) => candidate.normalizedTitle === incoming.normalizedTitle,
  );

  if (exactTitleOnly.length === 1) {
    return {
      kind: "matched",
      movieId: exactTitleOnly[0].id,
      matchedBy: "title_exact",
      confidence: "high",
    };
  }

  if (exactTitleOnly.length > 1) {
    return {
      kind: "conflict",
      reason: "Multiple exact title matches exist without a decisive year tie-breaker.",
      candidateMovieIds: exactTitleOnly.map((candidate) => candidate.id),
    };
  }

  const fuzzyCandidates = candidates
    .filter((candidate) => yearsCompatible(candidate.releaseYear, incoming.releaseYear, 1))
    .map((candidate) => ({
      ...candidate,
      score: titleSimilarity(candidate.normalizedTitle, incoming.normalizedTitle),
    }))
    .filter((candidate) => candidate.score >= 0.86)
    .sort((left, right) => right.score - left.score);

  if (fuzzyCandidates.length === 0) {
    return { kind: "new" };
  }

  if (
    fuzzyCandidates.length === 1 ||
    fuzzyCandidates[0].score - fuzzyCandidates[1].score >= 0.05
  ) {
    return {
      kind: "matched",
      movieId: fuzzyCandidates[0].id,
      matchedBy: "title_year_fuzzy",
      confidence: "medium",
    };
  }

  return {
    kind: "conflict",
    reason: "Multiple fuzzy matches exceeded the confidence threshold.",
    candidateMovieIds: fuzzyCandidates.map((candidate) => candidate.id),
  };
}