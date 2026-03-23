import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { movieExternalIds, movies, userMovieFollows } from "@/db/schema";
import { searchTmdbMovies } from "@/integrations/tmdb/client";
import { titleSimilarity } from "@/modules/catalog/matching";
import {
  normalizeTitle,
  parseReleaseYear,
  tmdbPosterUrl,
} from "@/modules/catalog/normalize";
import { resolvePosterUrl } from "@/modules/catalog/posters";
import type {
  MovieSearchImportSource,
  MovieSearchResult,
} from "@/modules/search/types";

type CatalogMovieRow = {
  movieId: string;
  title: string;
  normalizedTitle: string;
  releaseYear: number | null;
  releaseDate: string | null;
  posterUrl: string | null;
  shortDescription: string | null;
  score: number;
};

type SearchCandidate = MovieSearchResult & {
  normalizedTitle: string;
  score: number;
};

function buildCatalogResultKey(movieId: string) {
  return `movie:${movieId}`;
}

function buildTmdbResultKey(tmdbId: string) {
  return `tmdb:${tmdbId}`;
}

function yearsAreNear(left: number | null, right: number | null) {
  if (left == null || right == null) {
    return false;
  }

  return Math.abs(left - right) <= 1;
}

function sameCatalogIdentity(
  candidate: Pick<SearchCandidate, "normalizedTitle" | "releaseYear">,
  other: Pick<SearchCandidate, "normalizedTitle" | "releaseYear">,
) {
  return (
    candidate.normalizedTitle === other.normalizedTitle &&
    yearsAreNear(candidate.releaseYear, other.releaseYear)
  );
}

export function isStrongMovieSearchMatch(
  normalizedTitle: string,
  normalizedQuery: string,
) {
  return (
    normalizedTitle === normalizedQuery || normalizedTitle.startsWith(normalizedQuery)
  );
}

export function shouldSearchTmdb(
  localResultCount: number,
  hasStrongLocalMatch: boolean,
) {
  return localResultCount < 5 || !hasStrongLocalMatch;
}

export function scoreMovieSearchCandidate(
  normalizedTitle: string,
  normalizedQuery: string,
  releaseYear: number | null = null,
) {
  let score = 0;

  if (normalizedTitle === normalizedQuery) {
    score += 500;
  } else if (normalizedTitle.startsWith(normalizedQuery)) {
    score += 300;
  } else if (normalizedTitle.includes(normalizedQuery)) {
    score += 200;
  }

  score += titleSimilarity(normalizedTitle, normalizedQuery) * 100;

  if (releaseYear != null) {
    score += Math.min(Math.max(releaseYear - 1900, 0), 200) / 10;
  }

  return score;
}

function buildCatalogCandidate(
  row: CatalogMovieRow,
  followedSet: Set<string>,
): SearchCandidate {
  return {
    resultKey: buildCatalogResultKey(row.movieId),
    movieId: row.movieId,
    title: row.title,
    releaseYear: row.releaseYear,
    releaseDate: row.releaseDate,
    posterUrl: resolvePosterUrl(row.posterUrl),
    shortDescription: row.shortDescription,
    isFollowed: followedSet.has(row.movieId),
    isInCatalog: true,
    importSource: null,
    normalizedTitle: row.normalizedTitle,
    score: row.score,
  };
}

function buildRemoteCandidate(input: {
  tmdbId: string;
  title: string;
  normalizedTitle: string;
  releaseYear: number | null;
  releaseDate: string | null;
  posterUrl: string | null;
  shortDescription: string | null;
  score: number;
}): SearchCandidate {
  const importSource: MovieSearchImportSource = {
    provider: "tmdb",
    tmdbId: input.tmdbId,
  };

  return {
    resultKey: buildTmdbResultKey(input.tmdbId),
    movieId: null,
    title: input.title,
    releaseYear: input.releaseYear,
    releaseDate: input.releaseDate,
    posterUrl: resolvePosterUrl(input.posterUrl),
    shortDescription: input.shortDescription,
    isFollowed: false,
    isInCatalog: false,
    importSource,
    normalizedTitle: input.normalizedTitle,
    score: input.score,
  };
}

function finalizeSearchResults(results: SearchCandidate[]): MovieSearchResult[] {
  return results.map((result) => ({
    resultKey: result.resultKey,
    movieId: result.movieId,
    title: result.title,
    releaseYear: result.releaseYear,
    releaseDate: result.releaseDate,
    posterUrl: result.posterUrl,
    shortDescription: result.shortDescription,
    isFollowed: result.isFollowed,
    isInCatalog: result.isInCatalog,
    importSource: result.importSource,
  }));
}

function dedupeCatalogCandidates(candidates: SearchCandidate[]) {
  const byMovieId = new Map<string, SearchCandidate>();

  for (const candidate of candidates) {
    if (!candidate.movieId) {
      continue;
    }

    const existing = byMovieId.get(candidate.movieId);
    if (!existing || candidate.score > existing.score) {
      byMovieId.set(candidate.movieId, candidate);
    }
  }

  return [...byMovieId.values()];
}

function mergeSearchCandidates(input: {
  catalogCandidates: SearchCandidate[];
  remoteCandidates: SearchCandidate[];
  limit: number;
}) {
  const catalogCandidates = dedupeCatalogCandidates(input.catalogCandidates);
  const remoteCandidates: SearchCandidate[] = [];

  for (const candidate of input.remoteCandidates) {
    const duplicatesCatalog = catalogCandidates.some((catalogCandidate) =>
      sameCatalogIdentity(candidate, catalogCandidate),
    );

    if (duplicatesCatalog) {
      continue;
    }

    const existingRemoteIndex = remoteCandidates.findIndex((remoteCandidate) =>
      sameCatalogIdentity(candidate, remoteCandidate),
    );

    if (existingRemoteIndex >= 0) {
      if (candidate.score > remoteCandidates[existingRemoteIndex].score) {
        remoteCandidates[existingRemoteIndex] = candidate;
      }
      continue;
    }

    remoteCandidates.push(candidate);
  }

  return [...catalogCandidates, ...remoteCandidates]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.isInCatalog !== right.isInCatalog) {
        return left.isInCatalog ? -1 : 1;
      }

      if ((right.releaseYear ?? 0) !== (left.releaseYear ?? 0)) {
        return (right.releaseYear ?? 0) - (left.releaseYear ?? 0);
      }

      return left.title.localeCompare(right.title);
    })
    .slice(0, input.limit);
}

export async function searchMoviesForFollowFlow(input: {
  userId: string;
  locationId: string;
  query: string;
  limit?: number;
}) {
  const db = getDb();
  const normalizedQuery = normalizeTitle(input.query);
  const limit = Math.max(1, Math.min(input.limit ?? 20, 50));
  const localLimit = Math.max(limit, 5);

  if (normalizedQuery.length < 2) {
    return [];
  }

  const containsValue = `%${normalizedQuery}%`;
  const startsWithValue = `${normalizedQuery}%`;
  const similaritySql = sql<number>`similarity(${movies.normalizedTitle}, ${normalizedQuery})`;
  const rankSql = sql<number>`
    (
      case
        when ${movies.normalizedTitle} = ${normalizedQuery} then 500
        when ${movies.normalizedTitle} like ${startsWithValue} then 300
        when ${movies.normalizedTitle} like ${containsValue} then 200
        else 0
      end
    ) + (${similaritySql} * 100)
  `;

  const localRows = await db
    .select({
      movieId: movies.id,
      title: movies.canonicalTitle,
      normalizedTitle: movies.normalizedTitle,
      releaseYear: movies.releaseYear,
      releaseDate: movies.releaseDate,
      posterUrl: movies.posterUrl,
      shortDescription: movies.shortDescription,
      score: rankSql,
    })
    .from(movies)
    .where(
      sql`${movies.normalizedTitle} % ${normalizedQuery} or ${movies.normalizedTitle} like ${containsValue}`,
    )
    .orderBy(desc(rankSql), desc(similaritySql), desc(movies.releaseYear), asc(movies.canonicalTitle))
    .limit(localLimit);

  const hasStrongLocalMatch = localRows.some((row) =>
    isStrongMovieSearchMatch(row.normalizedTitle, normalizedQuery),
  );

  let tmdbResults: Awaited<ReturnType<typeof searchTmdbMovies>> = [];

  if (shouldSearchTmdb(localRows.length, hasStrongLocalMatch)) {
    try {
      tmdbResults = await searchTmdbMovies(input.query.trim());
    } catch (error) {
      console.error("TMDB search fallback failed:", error);
    }
  }

  const tmdbIds = [...new Set(tmdbResults.map((result) => String(result.id)).filter(Boolean))];
  const mappedTmdbRows = tmdbIds.length
    ? await db
        .select({
          tmdbId: movieExternalIds.externalId,
          movieId: movieExternalIds.movieId,
        })
        .from(movieExternalIds)
        .where(
          and(
            eq(movieExternalIds.provider, "tmdb"),
            eq(movieExternalIds.externalType, "tmdbId"),
            inArray(movieExternalIds.externalId, tmdbIds),
          ),
        )
    : [];

  const mappedTmdbIdToMovieId = new Map(
    mappedTmdbRows.map((row) => [row.tmdbId, row.movieId]),
  );
  const localMovieIds = new Set(localRows.map((row) => row.movieId));
  const extraCatalogMovieIds = [...new Set(mappedTmdbRows.map((row) => row.movieId))].filter(
    (movieId) => !localMovieIds.has(movieId),
  );

  const extraCatalogRows = extraCatalogMovieIds.length
    ? await db
        .select({
          movieId: movies.id,
          title: movies.canonicalTitle,
          normalizedTitle: movies.normalizedTitle,
          releaseYear: movies.releaseYear,
          releaseDate: movies.releaseDate,
          posterUrl: movies.posterUrl,
          shortDescription: movies.shortDescription,
        })
        .from(movies)
        .where(inArray(movies.id, extraCatalogMovieIds))
    : [];

  const catalogMovieIds = [
    ...new Set([...localRows.map((row) => row.movieId), ...extraCatalogRows.map((row) => row.movieId)]),
  ];
  const followedRows = catalogMovieIds.length
    ? await db
        .select({ movieId: userMovieFollows.movieId })
        .from(userMovieFollows)
        .where(
          and(
            eq(userMovieFollows.userId, input.userId),
            eq(userMovieFollows.locationId, input.locationId),
            inArray(userMovieFollows.movieId, catalogMovieIds),
          ),
        )
    : [];
  const followedSet = new Set(followedRows.map((row) => row.movieId));

  const catalogCandidates = [
    ...localRows.map((row) =>
      buildCatalogCandidate(
        {
          ...row,
          releaseYear: row.releaseYear ?? null,
          releaseDate: row.releaseDate ?? null,
          posterUrl: row.posterUrl ?? null,
          shortDescription: row.shortDescription ?? null,
          score: Number(row.score),
        },
        followedSet,
      ),
    ),
    ...extraCatalogRows.map((row) =>
      buildCatalogCandidate(
        {
          ...row,
          releaseYear: row.releaseYear ?? null,
          releaseDate: row.releaseDate ?? null,
          posterUrl: row.posterUrl ?? null,
          shortDescription: row.shortDescription ?? null,
          score: scoreMovieSearchCandidate(
            row.normalizedTitle,
            normalizedQuery,
            row.releaseYear ?? null,
          ),
        },
        followedSet,
      ),
    ),
  ];

  const remoteCandidates = tmdbResults
    .filter((result) => !mappedTmdbIdToMovieId.has(String(result.id)))
    .map((result) => {
      const title = result.title?.trim() || `TMDB ${result.id}`;
      const normalizedTitle = normalizeTitle(title);

      return buildRemoteCandidate({
        tmdbId: String(result.id),
        title,
        normalizedTitle,
        releaseYear: parseReleaseYear(result.release_date ?? undefined),
        releaseDate: result.release_date?.trim() || null,
        posterUrl: tmdbPosterUrl(result.poster_path),
        shortDescription: result.overview ?? null,
        score: scoreMovieSearchCandidate(
          normalizedTitle,
          normalizedQuery,
          parseReleaseYear(result.release_date ?? undefined),
        ),
      });
    });

  return finalizeSearchResults(
    mergeSearchCandidates({
      catalogCandidates,
      remoteCandidates,
      limit,
    }),
  );
}
