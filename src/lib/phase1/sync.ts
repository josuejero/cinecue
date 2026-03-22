import { getDb } from "@/db/client";
import {
  locations,
  movieExternalIds,
  movies,
  providerMappingConflicts,
  providerPayloadArchive,
  providerSyncRuns,
  showtimes,
  theatreExternalIds,
  theatres,
} from "@/db/schema";
import { chooseBestCandidate } from "@/lib/matching";
import {
  normalizePostalCode,
  normalizeReleaseDate,
  normalizeTitle,
  parseReleaseYear,
} from "@/lib/normalize";
import {
  getAllShowingsByZip,
  getFutureReleases,
  getTheatresByZip,
  isGracenoteRequestNotAuthorizedError,
} from "@/lib/providers/gracenote";
import {
  findTmdbMovieByImdbId,
  getTmdbMovieDetails,
  mapTmdbDetailsToMovieSeed,
  searchTmdbMovies,
} from "@/lib/providers/tmdb";
import type {
  NormalizedMovieSeed,
  NormalizedShowing,
  NormalizedTheatre,
  SourceProvider
} from "@/lib/providers/types";
import { refreshLocationReadModelByNormalizedKey } from "@/lib/phase2/read-model";
import { and, eq, gte, like, lte } from "drizzle-orm";
import crypto from "node:crypto";

type ResolveMovieOutcome =
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

type SyncSummary = {
  syncRunId: string;
  processed: number;
  created: number;
  updated: number;
  conflicts: number;
};

async function buildSkippedSyncSummary(
  zip: string,
  jobType: string,
  extras: Record<string, unknown> = {},
) {
  const locationKey = buildLocationKey(zip);
  await refreshLocationReadModelByNormalizedKey(locationKey);

  return {
    syncRunId: `skipped:gracenote:${jobType}:${createId()}`,
    processed: 0,
    created: 0,
    updated: 0,
    conflicts: 0,
    skipped: true as const,
    ...extras,
  };
}

const SHOWINGS_ARCHIVE_CHUNK_SIZE = 100;

function createId() {
  return crypto.randomUUID();
}

function safeJsonStringify(payload: unknown) {
  const seen = new WeakSet<object>();

  return JSON.stringify(payload, (_key, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }

    if (value && typeof value === "object") {
      if (seen.has(value as object)) {
        return "[Circular]";
      }

      seen.add(value as object);
    }

    return value;
  });
}

function hashPayload(payload: unknown) {
  return crypto.createHash("sha256").update(safeJsonStringify(payload)).digest("hex");
}

function chunkItems<T>(items: T[], size: number) {
  if (size <= 0) {
    throw new Error("Chunk size must be greater than 0.");
  }

  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function buildLocationKey(zip: string) {
  const normalizedZip = normalizePostalCode(zip);
  if (!normalizedZip) {
    throw new Error("A valid ZIP or postal code is required.");
  }

  return `zip:${normalizedZip}`;
}

function buildMovieCacheKey(movie: NormalizedMovieSeed) {
  return (
    movie.rootId ??
    movie.tmsId ??
    movie.imdbId ??
    movie.tmdbId ??
    `${movie.normalizedTitle}|${movie.releaseYear ?? "na"}`
  );
}

function collectMovieExternalIds(movie: NormalizedMovieSeed) {
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

async function beginSyncRun(
  provider: SourceProvider,
  jobType: string,
  requestParams: Record<string, unknown>,
  locationKey?: string,
) {
  const db = getDb();
  const syncRunId = createId();

  await db.insert(providerSyncRuns).values({
    id: syncRunId,
    provider,
    jobType,
    locationKey: locationKey ?? null,
    requestParams,
    status: "running",
    startedAt: new Date(),
  });

  return syncRunId;
}

async function completeSyncRun(syncRunId: string) {
  const db = getDb();

  await db
    .update(providerSyncRuns)
    .set({
      status: "succeeded",
      finishedAt: new Date(),
    })
    .where(eq(providerSyncRuns.id, syncRunId));
}

async function failSyncRun(syncRunId: string, error: unknown) {
  const db = getDb();

  await db
    .update(providerSyncRuns)
    .set({
      status: "failed",
      finishedAt: new Date(),
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    .where(eq(providerSyncRuns.id, syncRunId));
}

async function archivePayload(
  syncRunId: string,
  provider: SourceProvider,
  resourceType: string,
  resourceKey: string,
  payload: unknown,
) {
  const db = getDb();

  await db.insert(providerPayloadArchive).values({
    id: createId(),
    syncRunId,
    provider,
    resourceType,
    resourceKey,
    payload,
    payloadHash: hashPayload(payload),
    observedAt: new Date(),
  });
}

function compactMovieForArchive(movie: NormalizedMovieSeed) {
  return {
    provider: movie.provider,
    tmsId: movie.tmsId ?? null,
    rootId: movie.rootId ?? null,
    tmdbId: movie.tmdbId ?? null,
    imdbId: movie.imdbId ?? null,
    title: movie.title,
    normalizedTitle: movie.normalizedTitle,
    releaseYear: movie.releaseYear ?? null,
    releaseDate: movie.releaseDate ?? null,
    entityType: movie.entityType ?? null,
    subType: movie.subType ?? null,
    runtimeMinutes: movie.runtimeMinutes ?? null,
    posterUrl: movie.posterUrl ?? null,
  };
}

function compactTheatreForArchive(theatre: NormalizedTheatre) {
  return {
    provider: theatre.provider,
    externalId: theatre.externalId,
    externalType: theatre.externalType,
    name: theatre.name,
    chainName: theatre.chainName ?? null,
    city: theatre.city ?? null,
    state: theatre.state ?? null,
    postalCode: theatre.postalCode ?? null,
    countryCode: theatre.countryCode ?? null,
    identityKey: theatre.identityKey,
  };
}

function compactShowingForArchive(showing: NormalizedShowing) {
  return {
    provider: showing.provider,
    startAtLocal: showing.startAtLocal,
    businessDate: showing.businessDate,
    qualities: showing.qualities ?? null,
    ticketUrl: showing.ticketUrl ?? null,
    isBargain: showing.isBargain,
    isAdvanceTicket: showing.isAdvanceTicket,
    movie: compactMovieForArchive(showing.movie),
    theatre: compactTheatreForArchive(showing.theatre),
    rawShowtime: showing.raw,
  };
}

async function archiveShowingsPayload(input: {
  syncRunId: string;
  zip: string;
  startDate: string;
  numDays: number;
  showingsPayload: NormalizedShowing[];
}) {
  const locationKey = buildLocationKey(input.zip);
  const compactShowings = input.showingsPayload.map(compactShowingForArchive);
  const chunks = chunkItems(compactShowings, SHOWINGS_ARCHIVE_CHUNK_SIZE);

  if (chunks.length === 0) {
    await archivePayload(
      input.syncRunId,
      "gracenote",
      "showings",
      `${locationKey}:${input.startDate}:${input.numDays}:part-1-of-1`,
      {
        kind: "showings_archive_chunk",
        locationKey,
        startDate: input.startDate,
        numDays: input.numDays,
        part: 1,
        totalParts: 1,
        itemCount: 0,
        items: [],
      },
    );
    return;
  }

  for (const [index, chunk] of chunks.entries()) {
    await archivePayload(
      input.syncRunId,
      "gracenote",
      "showings",
      `${locationKey}:${input.startDate}:${input.numDays}:part-${index + 1}-of-${chunks.length}`,
      {
        kind: "showings_archive_chunk",
        locationKey,
        startDate: input.startDate,
        numDays: input.numDays,
        part: index + 1,
        totalParts: chunks.length,
        itemCount: chunk.length,
        items: chunk,
      },
    );
  }
}

async function upsertZipLocation(zip: string, radiusMiles: number) {
  const db = getDb();
  const normalizedZip = normalizePostalCode(zip);

  if (!normalizedZip) {
    throw new Error("A valid ZIP or postal code is required.");
  }

  const locationId = createId();
  const normalizedKey = buildLocationKey(normalizedZip);

  await db.insert(locations).values({
    id: locationId,
    kind: "zip",
    normalizedKey,
    postalCode: normalizedZip,
    radiusMiles,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: locations.normalizedKey,
    set: {
      postalCode: normalizedZip,
      radiusMiles,
      updatedAt: new Date(),
    },
  });

  const [location] = await db
    .select({
      id: locations.id,
      normalizedKey: locations.normalizedKey,
    })
    .from(locations)
    .where(eq(locations.normalizedKey, normalizedKey))
    .limit(1);

  if (!location) {
    throw new Error("Failed to upsert location.");
  }

  return location;
}

async function upsertTheatre(theatre: NormalizedTheatre) {
  const db = getDb();

  const [mappedExternal] = await db
    .select({
      theatreId: theatreExternalIds.theatreId,
    })
    .from(theatreExternalIds)
    .where(
      and(
        eq(theatreExternalIds.provider, theatre.provider),
        eq(theatreExternalIds.externalType, theatre.externalType),
        eq(theatreExternalIds.externalId, theatre.externalId),
      ),
    )
    .limit(1);

  const [identityMatch] = mappedExternal
    ? []
    : await db
        .select({
          id: theatres.id,
        })
        .from(theatres)
        .where(eq(theatres.identityKey, theatre.identityKey))
        .limit(1);

  const theatreId = mappedExternal?.theatreId ?? identityMatch?.id ?? createId();

  await db.insert(theatres).values({
    id: theatreId,
    identityKey: theatre.identityKey,
    chainName: theatre.chainName ?? null,
    name: theatre.name,
    normalizedName: normalizeTitle(theatre.name),
    address1: theatre.address1 ?? null,
    address2: theatre.address2 ?? null,
    city: theatre.city ?? null,
    state: theatre.state ?? null,
    postalCode: theatre.postalCode ?? null,
    countryCode: theatre.countryCode ?? "USA",
    latitude: theatre.latitude ?? null,
    longitude: theatre.longitude ?? null,
    phone: theatre.phone ?? null,
    timeZone: theatre.timeZone ?? null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: theatres.id,
    set: {
      identityKey: theatre.identityKey,
      chainName: theatre.chainName ?? null,
      name: theatre.name,
      normalizedName: normalizeTitle(theatre.name),
      address1: theatre.address1 ?? null,
      address2: theatre.address2 ?? null,
      city: theatre.city ?? null,
      state: theatre.state ?? null,
      postalCode: theatre.postalCode ?? null,
      countryCode: theatre.countryCode ?? "USA",
      latitude: theatre.latitude ?? null,
      longitude: theatre.longitude ?? null,
      phone: theatre.phone ?? null,
      timeZone: theatre.timeZone ?? null,
      active: true,
      updatedAt: new Date(),
    },
  });

  await db.insert(theatreExternalIds).values({
    theatreId,
    provider: theatre.provider,
    externalType: theatre.externalType,
    externalId: theatre.externalId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [
      theatreExternalIds.provider,
      theatreExternalIds.externalType,
      theatreExternalIds.externalId,
    ],
    set: {
      theatreId,
      updatedAt: new Date(),
    },
  });

  return theatreId;
}

async function findMovieByKnownExternalIds(movie: NormalizedMovieSeed) {
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

async function upsertMovieExternalIdLinks(
  movieId: string,
  movie: NormalizedMovieSeed,
  matchedBy: string,
  confidence: "high" | "medium",
) {
  const db = getDb();

  for (const identifier of collectMovieExternalIds(movie)) {
    await db.insert(movieExternalIds).values({
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
    }).onConflictDoUpdate({
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

async function updateMovieMetadata(movieId: string, movie: NormalizedMovieSeed) {
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

async function createMovie(movie: NormalizedMovieSeed) {
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

async function recordConflict(movie: NormalizedMovieSeed, reason: string, candidateMovieIds: string[]) {
  const db = getDb();

  const preferredExternal =
    collectMovieExternalIds(movie)[0] ??
    ({
      provider: "app",
      externalType: "normalizedTitle",
      externalId: `${movie.normalizedTitle}|${movie.releaseYear ?? "na"}`,
    } as const);

  const conflictKey = `${preferredExternal.provider}:${preferredExternal.externalType}:${preferredExternal.externalId}`;

  await db.insert(providerMappingConflicts).values({
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
  }).onConflictDoUpdate({
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

async function maybeEnrichMovieWithTmdb(movie: NormalizedMovieSeed) {
  try {
    if (movie.tmdbId || movie.imdbId) {
      if (movie.imdbId) {
        const tmdbSearchHit = await findTmdbMovieByImdbId(movie.imdbId);
        if (tmdbSearchHit) {
          const details = await getTmdbMovieDetails(tmdbSearchHit.id);
          return mapTmdbDetailsToMovieSeed(details);
        }
      }
    }

    const searchResults = await searchTmdbMovies(movie.title, movie.releaseYear ?? undefined);
    const exact = searchResults.find(
      (result) =>
        normalizeTitle(result.title) === movie.normalizedTitle &&
        Math.abs((parseReleaseYear(result.release_date) ?? movie.releaseYear ?? 0) - (movie.releaseYear ?? 0)) <= 1,
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

async function resolveOrCreateMovie(movie: NormalizedMovieSeed): Promise<ResolveMovieOutcome> {
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

  const candidates = movie.releaseYear != null
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

async function resolveMovieWithEnrichment(movie: NormalizedMovieSeed) {
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

async function upsertShowtime(
  showing: NormalizedShowing,
  movieId: string,
  theatreId: string,
  locationId: string,
) {
  const db = getDb();
  const startAtLocalDate = new Date(showing.startAtLocal);
  if (Number.isNaN(startAtLocalDate.getTime())) {
    throw new Error(`Invalid showtime startAtLocal value: ${showing.startAtLocal}`);
  }

  await db
    .insert(showtimes)
    .values({
      id: createId(),
      movieId,
      theatreId,
      locationId,
      provider: showing.provider,
      sourceMovieExternalId: showing.movie.tmsId ?? showing.movie.rootId ?? null,
      startAtLocal: startAtLocalDate,
      businessDate: showing.businessDate,
      qualities: showing.qualities ?? null,
      ticketUrl: showing.ticketUrl ?? null,
      isBargain: showing.isBargain,
      isAdvanceTicket: showing.isAdvanceTicket,
      rawShowtime: showing.raw,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        showtimes.provider,
        showtimes.locationId,
        showtimes.theatreId,
        showtimes.movieId,
        showtimes.startAtLocal,
      ],
      set: {
        businessDate: showing.businessDate,
        qualities: showing.qualities ?? null,
        ticketUrl: showing.ticketUrl ?? null,
        isBargain: showing.isBargain,
        isAdvanceTicket: showing.isAdvanceTicket,
        rawShowtime: showing.raw,
        updatedAt: new Date(),
      },
    });
}

export async function syncTheatresByZip(input: {
  zip: string;
  radiusMiles?: number;
  numTheatres?: number;
}): Promise<SyncSummary & { theatres: number }> {
  const normalizedZip = normalizePostalCode(input.zip);
  if (!normalizedZip) {
    throw new Error("ZIP code is required.");
  }

  const radiusMiles = input.radiusMiles ?? 25;
  const syncRunId = await beginSyncRun(
    "gracenote",
    "theatres_by_zip",
    { zip: normalizedZip, radiusMiles, numTheatres: input.numTheatres ?? 100 },
    buildLocationKey(normalizedZip),
  );

  try {
    await upsertZipLocation(normalizedZip, radiusMiles);

    const normalizedTheatres = await getTheatresByZip({
      zip: normalizedZip,
      radiusMiles,
      numTheatres: input.numTheatres,
    });

    await archivePayload(
      syncRunId,
      "gracenote",
      "theatres",
      buildLocationKey(normalizedZip),
      normalizedTheatres,
    );

    let createdOrUpdated = 0;
    for (const theatre of normalizedTheatres) {
      await upsertTheatre(theatre);
      createdOrUpdated += 1;
    }

    await completeSyncRun(syncRunId);

    return {
      syncRunId,
      processed: normalizedTheatres.length,
      created: 0,
      updated: createdOrUpdated,
      conflicts: 0,
      theatres: normalizedTheatres.length,
    };
  } catch (error) {
    await failSyncRun(syncRunId, error);
    throw error;
  }
}

export async function syncShowingsByZip(input: {
  zip: string;
  startDate: string;
  numDays?: number;
  radiusMiles?: number;
}): Promise<SyncSummary & { showtimes: number }> {
  const normalizedZip = normalizePostalCode(input.zip);
  if (!normalizedZip) {
    throw new Error("ZIP code is required.");
  }

  const radiusMiles = input.radiusMiles ?? 25;
  const syncRunId = await beginSyncRun(
    "gracenote",
    "showings_by_zip",
    {
      zip: normalizedZip,
      startDate: input.startDate,
      numDays: input.numDays ?? 7,
      radiusMiles,
    },
    buildLocationKey(normalizedZip),
  );

  try {
    const location = await upsertZipLocation(normalizedZip, radiusMiles);

    const normalizedShowings = await getAllShowingsByZip({
      zip: normalizedZip,
      startDate: input.startDate,
      numDays: input.numDays,
      radiusMiles,
    });

    await archiveShowingsPayload({
      syncRunId,
      zip: normalizedZip,
      startDate: input.startDate,
      numDays: input.numDays ?? 7,
      showingsPayload: normalizedShowings,
    });

    const resolutionCache = new Map<string, ResolveMovieOutcome>();
    let created = 0;
    let updated = 0;
    let conflicts = 0;
    let showtimeCount = 0;

    for (const showing of normalizedShowings) {
      const cacheKey = buildMovieCacheKey(showing.movie);
      let resolution = resolutionCache.get(cacheKey);

      if (!resolution) {
        resolution = await resolveMovieWithEnrichment(showing.movie);
        resolutionCache.set(cacheKey, resolution);
      }

      if (resolution.kind === "conflict") {
        conflicts += 1;
        continue;
      }

      const theatreId = await upsertTheatre(showing.theatre);
      await upsertShowtime(showing, resolution.movieId, theatreId, location.id);

      if (resolution.created) {
        created += 1;
      } else {
        updated += 1;
      }

      showtimeCount += 1;
    }

    await completeSyncRun(syncRunId);

    return {
      syncRunId,
      processed: normalizedShowings.length,
      created,
      updated,
      conflicts,
      showtimes: showtimeCount,
    };
  } catch (error) {
    await failSyncRun(syncRunId, error);
    throw error;
  }
}

export async function syncFutureReleasesPhaseOne(input: {
  releaseDate: string;
  numDays?: number;
  country?: "USA" | "CAN";
}): Promise<SyncSummary> {
  const syncRunId = await beginSyncRun("gracenote", "future_releases", {
    releaseDate: input.releaseDate,
    numDays: input.numDays ?? 60,
    country: input.country ?? "USA",
  });

  try {
    const normalizedReleases = await getFutureReleases({
      releaseDate: input.releaseDate,
      numDays: input.numDays,
      country: input.country,
    });

    await archivePayload(
      syncRunId,
      "gracenote",
      "future_releases",
      `${input.country ?? "USA"}:${input.releaseDate}:${input.numDays ?? 60}`,
      normalizedReleases,
    );

    let created = 0;
    let updated = 0;
    let conflicts = 0;

    for (const release of normalizedReleases) {
      const resolution = await resolveMovieWithEnrichment(release.movie);

      if (resolution.kind === "conflict") {
        conflicts += 1;
        continue;
      }

      if (resolution.created) {
        created += 1;
      } else {
        updated += 1;
      }
    }

    await completeSyncRun(syncRunId);

    return {
      syncRunId,
      processed: normalizedReleases.length,
      created,
      updated,
      conflicts,
    };
  } catch (error) {
    await failSyncRun(syncRunId, error);
    throw error;
  }
}

export async function syncZipPhaseOne(input: {
  zip: string;
  startDate: string;
  numDays?: number;
  radiusMiles?: number;
  country?: "USA" | "CAN";
}) {
  let theatresSummary;
  try {
    theatresSummary = await syncTheatresByZip({
      zip: input.zip,
      radiusMiles: input.radiusMiles,
    });
  } catch (error) {
    if (isGracenoteRequestNotAuthorizedError(error)) {
      console.warn(
        "Gracenote theatre sync (theatres endpoint) returned 403 Not Authorized; skipping the dedicated theatre sync and continuing with showings. This key likely does not include Theatre List access.",
      );
    theatresSummary = await buildSkippedSyncSummary(input.zip, "theatres", {
      theatres: 0,
      reason: "gracenote_not_authorized",
    });
    } else {
      throw error;
    }
  }

  const showingsSummary = await syncShowingsByZip({
    zip: input.zip,
    startDate: input.startDate,
    numDays: input.numDays,
    radiusMiles: input.radiusMiles,
  });

  let futureReleasesSummary;
  try {
    futureReleasesSummary = await syncFutureReleasesPhaseOne({
      releaseDate: input.startDate,
      numDays: Math.min(input.numDays ?? 7, 60),
      country: input.country ?? "USA",
    });
  } catch (error) {
    if (isGracenoteRequestNotAuthorizedError(error)) {
      console.warn(
        "Gracenote future releases sync (movies/futureReleases endpoint) returned 403 Not Authorized; skipping future releases and continuing with showings-only data. This key likely does not include Future Releases access.",
      );
    futureReleasesSummary = await buildSkippedSyncSummary(input.zip, "future_releases", {
      reason: "gracenote_not_authorized",
    });
    } else {
      throw error;
    }
  }

  return {
    zip: normalizePostalCode(input.zip),
    startDate: input.startDate,
    numDays: input.numDays ?? 7,
    radiusMiles: input.radiusMiles ?? 25,
    theatres: theatresSummary,
    showings: showingsSummary,
    futureReleases: futureReleasesSummary,
  };
}
