import crypto from "node:crypto";
import { and, eq, gte, like, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { movieExternalIds, movies, providerMappingConflicts } from "@/db/schema";
import {
  findTmdbMovieByImdbId,
  getTmdbMovieDetails,
  searchTmdbMovies,
} from "@/integrations/tmdb/client";
import { mapTmdbDetailsToMovieSeed } from "@/integrations/tmdb/mapper";
import { chooseBestCandidate } from "@/modules/catalog/matching";
import {
  normalizeReleaseDate,
  normalizeTitle,
  parseReleaseYear,
} from "@/modules/catalog/normalize";
import type { NormalizedMovieSeed } from "@/modules/catalog/types";
import type { SourceProvider } from "@/shared/types/source-provider";
import { BadRequestError, ConflictError } from "@/shared/http/errors";

export type ResolveMovieOutcome =
  | {
      kind: "matched";
      movieId: string;
      matchedBy: string;
      confidence: "high" | "medium";
      created: boolean;
    }
  | {
      kind: "conflict";
      reason: string;
    };

function createId() {
  return crypto.randomUUID();
}

export function collectMovieExternalIds(movie: NormalizedMovieSeed) {
  return [
    movie.tmsId
      ? {
          provider: "gracenote" as const,
          externalType: "tmsId",
          externalId: movie.tmsId,
        }
      : null,
    movie.rootId
      ? {
          provider: "gracenote" as const,
          externalType: "rootId",
          externalId: movie.rootId,
        }
      : null,
    movie.imdbId
      ? {
          provider: "imdb" as const,
          externalType: "imdbId",
          externalId: movie.imdbId,
        }
      : null,
    movie.tmdbId
      ? {
          provider: "tmdb" as const,
          externalType: "tmdbId",
          externalId: movie.tmdbId,
        }
      : null,
  ].filter(Boolean) as Array<{
    provider: SourceProvider;
    externalType: string;
    externalId: string;
  }>;
}

export async function findMovieByKnownExternalIds(movie: NormalizedMovieSeed) {
  const db = getDb();

  for (const identifier of collectMovieExternalIds(movie)) {
    const [match] = await db
      .select({
        movieId: movieExternalIds.movieId,
      })
      .from(movieExternalIds)
      .where(
        and(
          eq(movieExternalIds.provider, identifier.provider),
          eq(movieExternalIds.externalType, identifier.externalType),
          eq(movieExternalIds.externalId, identifier.externalId),
        ),
      )
      .limit(1);

    if (match) {
      return match.movieId;
    }
  }

  return null;
}

export async function upsertMovieExternalIdLinks(
  movieId: string,
  movie: NormalizedMovieSeed,
  matchedBy: string,
  confidence: "high" | "medium",
) {
  const db = getDb();

  for (const identifier of collectMovieExternalIds(movie)) {
    await db
      .insert(movieExternalIds)
      .values({
        movieId,
        provider: identifier.provider,
        externalType: identifier.externalType,
        externalId: identifier.externalId,
        isPrimary:
          identifier.provider === "gracenote" &&
          identifier.externalType === "tmsId",
        confidence,
        matchedBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          movieExternalIds.provider,
          movieExternalIds.externalType,
          movieExternalIds.externalId,
        ],
        set: {
          movieId,
          confidence,
          matchedBy,
          updatedAt: new Date(),
        },
      });
  }
}

export async function updateMovieMetadata(movieId: string, movie: NormalizedMovieSeed) {
  const db = getDb();
  const normalizedReleaseDate = normalizeReleaseDate(movie.releaseDate);

  const update: Record<string, unknown> = {
    canonicalTitle: movie.title,
    normalizedTitle: movie.normalizedTitle,
    updatedAt: new Date(),
  };

  if (movie.releaseYear != null) {
    update.releaseYear = movie.releaseYear;
  }

  if (normalizedReleaseDate) {
    update.releaseDate = normalizedReleaseDate;
  }

  if (movie.entityType) {
    update.entityType = movie.entityType;
  }

  if (movie.subType) {
    update.subType = movie.subType;
  }

  if (movie.shortDescription) {
    update.shortDescription = movie.shortDescription;
  }

  if (movie.longDescription) {
    update.longDescription = movie.longDescription;
  }

  if (movie.runtimeMinutes != null) {
    update.runtimeMinutes = movie.runtimeMinutes;
  }

  if (movie.posterUrl) {
    update.posterUrl = movie.posterUrl;
  }

  await db.update(movies).set(update).where(eq(movies.id, movieId));
}

export async function createMovie(movie: NormalizedMovieSeed) {
  const db = getDb();
  const movieId = createId();
  const normalizedReleaseDate = normalizeReleaseDate(movie.releaseDate);

  await db.insert(movies).values({
    id: movieId,
    canonicalTitle: movie.title,
    normalizedTitle: movie.normalizedTitle,
    releaseYear: movie.releaseYear ?? null,
    ...(normalizedReleaseDate ? { releaseDate: normalizedReleaseDate } : {}),
    entityType: movie.entityType ?? "Movie",
    subType: movie.subType ?? null,
    shortDescription: movie.shortDescription ?? null,
    longDescription: movie.longDescription ?? null,
    runtimeMinutes: movie.runtimeMinutes ?? null,
    posterUrl: movie.posterUrl ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return movieId;
}

export async function recordConflict(
  movie: NormalizedMovieSeed,
  reason: string,
  candidateMovieIds: string[],
) {
  const db = getDb();

  const preferredExternal =
    collectMovieExternalIds(movie)[0] ??
    ({
      provider: "app",
      externalType: "normalizedTitle",
      externalId: `${movie.normalizedTitle}|${movie.releaseYear ?? "na"}`,
    } as const);

  const conflictKey = `${preferredExternal.provider}:${preferredExternal.externalType}:${preferredExternal.externalId}`;

  await db
    .insert(providerMappingConflicts)
    .values({
      id: createId(),
      conflictKey,
      provider: preferredExternal.provider,
      externalType: preferredExternal.externalType,
      externalId: preferredExternal.externalId,
      normalizedTitle: movie.normalizedTitle,
      releaseYear: movie.releaseYear ?? null,
      candidateMovieIds,
      reason,
      sourcePayload: movie.raw,
      status: "open",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: providerMappingConflicts.conflictKey,
      set: {
        normalizedTitle: movie.normalizedTitle,
        releaseYear: movie.releaseYear ?? null,
        candidateMovieIds,
        reason,
        sourcePayload: movie.raw,
        status: "open",
        updatedAt: new Date(),
      },
    });
}

export async function maybeEnrichMovieWithTmdb(movie: NormalizedMovieSeed) {
  try {
    if (movie.tmdbId) {
      const tmdbMovieId = Number(movie.tmdbId);
      if (Number.isFinite(tmdbMovieId)) {
        const details = await getTmdbMovieDetails(tmdbMovieId);
        return mapTmdbDetailsToMovieSeed(details);
      }
    }

    if (movie.imdbId) {
      const tmdbSearchHit = await findTmdbMovieByImdbId(movie.imdbId);
      if (tmdbSearchHit) {
        const details = await getTmdbMovieDetails(tmdbSearchHit.id);
        return mapTmdbDetailsToMovieSeed(details);
      }
    }

    const searchResults = await searchTmdbMovies(movie.title, movie.releaseYear ?? undefined);
    const exact = searchResults.find(
      (result) =>
        normalizeTitle(result.title) === movie.normalizedTitle &&
        Math.abs(
          (parseReleaseYear(result.release_date) ?? movie.releaseYear ?? 0) -
            (movie.releaseYear ?? 0),
        ) <= 1,
    );

    const fallback = exact ?? searchResults[0];
    if (!fallback) {
      return null;
    }

    const details = await getTmdbMovieDetails(fallback.id);
    const mapped = mapTmdbDetailsToMovieSeed(details);

    const titleLooksClose =
      mapped.normalizedTitle === movie.normalizedTitle ||
      mapped.normalizedTitle.includes(movie.normalizedTitle) ||
      movie.normalizedTitle.includes(mapped.normalizedTitle);

    const yearLooksClose =
      movie.releaseYear == null ||
      mapped.releaseYear == null ||
      Math.abs(mapped.releaseYear - movie.releaseYear) <= 1;

    return titleLooksClose && yearLooksClose ? mapped : null;
  } catch (error) {
    console.error("TMDB enrichment failed:", error);
    return null;
  }
}

export async function resolveOrCreateMovie(
  movie: NormalizedMovieSeed,
): Promise<ResolveMovieOutcome> {
  const db = getDb();

  const knownMovieId = await findMovieByKnownExternalIds(movie);
  if (knownMovieId) {
    await updateMovieMetadata(knownMovieId, movie);
    await upsertMovieExternalIdLinks(knownMovieId, movie, "provider_external_id", "high");

    return {
      kind: "matched",
      movieId: knownMovieId,
      matchedBy: "provider_external_id",
      confidence: "high",
      created: false,
    };
  }

  const firstToken = movie.normalizedTitle.split(" ").filter(Boolean)[0] ?? movie.normalizedTitle;

  const candidates =
    movie.releaseYear != null
      ? await db
          .select({
            id: movies.id,
            normalizedTitle: movies.normalizedTitle,
            releaseYear: movies.releaseYear,
          })
          .from(movies)
          .where(
            and(
              gte(movies.releaseYear, movie.releaseYear - 1),
              lte(movies.releaseYear, movie.releaseYear + 1),
              like(movies.normalizedTitle, `%${firstToken}%`),
            ),
          )
          .limit(50)
      : await db
          .select({
            id: movies.id,
            normalizedTitle: movies.normalizedTitle,
            releaseYear: movies.releaseYear,
          })
          .from(movies)
          .where(like(movies.normalizedTitle, `%${firstToken}%`))
          .limit(50);

  const matchResult = chooseBestCandidate(
    {
      normalizedTitle: movie.normalizedTitle,
      releaseYear: movie.releaseYear ?? null,
    },
    candidates.map((candidate) => ({
      id: candidate.id,
      normalizedTitle: candidate.normalizedTitle,
      releaseYear: candidate.releaseYear ?? null,
    })),
  );

  if (matchResult.kind === "matched") {
    await updateMovieMetadata(matchResult.movieId, movie);
    await upsertMovieExternalIdLinks(
      matchResult.movieId,
      movie,
      matchResult.matchedBy,
      matchResult.confidence,
    );

    return {
      kind: "matched",
      movieId: matchResult.movieId,
      matchedBy: matchResult.matchedBy,
      confidence: matchResult.confidence,
      created: false,
    };
  }

  if (matchResult.kind === "conflict") {
    await recordConflict(movie, matchResult.reason, matchResult.candidateMovieIds);

    return {
      kind: "conflict",
      reason: matchResult.reason,
    };
  }

  const movieId = await createMovie(movie);
  await upsertMovieExternalIdLinks(movieId, movie, "new_movie", "high");

  return {
    kind: "matched",
    movieId,
    matchedBy: "new_movie",
    confidence: "high",
    created: true,
  };
}

export async function resolveMovieWithEnrichment(movie: NormalizedMovieSeed) {
  const tmdbEnrichment = await maybeEnrichMovieWithTmdb(movie);

  const enrichedMovie: NormalizedMovieSeed = tmdbEnrichment
    ? {
        ...movie,
        tmdbId: movie.tmdbId ?? tmdbEnrichment.tmdbId ?? null,
        imdbId: movie.imdbId ?? tmdbEnrichment.imdbId ?? null,
        releaseDate: movie.releaseDate ?? tmdbEnrichment.releaseDate ?? null,
        releaseYear: movie.releaseYear ?? tmdbEnrichment.releaseYear ?? null,
        shortDescription: movie.shortDescription ?? tmdbEnrichment.shortDescription ?? null,
        longDescription: movie.longDescription ?? tmdbEnrichment.longDescription ?? null,
        runtimeMinutes: movie.runtimeMinutes ?? tmdbEnrichment.runtimeMinutes ?? null,
        posterUrl: movie.posterUrl ?? tmdbEnrichment.posterUrl ?? null,
        raw: {
          gracenote: movie.raw,
          tmdb: tmdbEnrichment.raw,
        },
      }
    : movie;

  return resolveOrCreateMovie(enrichedMovie);
}

export async function resolveOrCreateMovieFromTmdbId(tmdbId: string) {
  const parsedTmdbId = Number(tmdbId);

  if (!Number.isInteger(parsedTmdbId) || parsedTmdbId <= 0) {
    throw new BadRequestError("A valid TMDB movie ID is required.");
  }

  const details = await getTmdbMovieDetails(parsedTmdbId);
  const movie = mapTmdbDetailsToMovieSeed(details);
  const outcome = await resolveOrCreateMovie(movie);

  if (outcome.kind === "conflict") {
    throw new ConflictError(
      `Movie import is ambiguous: ${outcome.reason}`,
    );
  }

  return {
    movieId: outcome.movieId,
    created: outcome.created,
  };
}
