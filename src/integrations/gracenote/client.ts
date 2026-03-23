import fs from "fs";
import path from "path";

import { getServerEnv } from "@/lib/env";
import {
  businessDateFromIso,
  normalizePostalCode,
  normalizeTheatreIdentityKey,
  normalizeTitle,
  normalizeReleaseDate,
  parseReleaseYear,
  runtimeIsoToMinutes,
} from "@/lib/normalize";
import type {
  NormalizedFutureRelease,
  NormalizedMovieSeed,
  NormalizedShowing,
  NormalizedTheatre,
} from "@/lib/providers/types";

type RawGracenoteTheatre = {
  id: string | number;
  name: string;
  chain?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  lat?: string | number;
  lng?: string | number;
  phone?: string;
  timeZone?: string;
};

type RawGracenoteShowtime = {
  theatre: {
    id: string | number;
    name: string;
  };
  dateTime: string;
  quals?: string;
  ticketURI?: string;
  barg?: boolean;
};

type RawGracenoteMovie = {
  tmsId?: string;
  rootId?: string | number;
  title: string;
  releaseYear?: number;
  releaseDate?: string;
  entityType?: string;
  subType?: string;
  shortDescription?: string;
  longDescription?: string;
  runTime?: string;
  preferredImage?: {
    uri?: string;
  };
  showtimes?: RawGracenoteShowtime[];
};

type RawGracenoteFutureRelease = {
  tmsId?: string;
  rootId?: string | number;
  title: string;
  releaseYear?: number;
  releaseDate?: string;
  entityType?: string;
  subType?: string;
  shortDescription?: string;
  longDescription?: string;
  runTime?: string;
  preferredImage?: {
    uri?: string;
  };
  releases?: Array<{
    date: string;
    country?: string;
    type?: string;
    distributors?: Array<{ name?: string }>;
  }>;
};

let cachedExampleGracenoteKey: string | null | undefined;

function getExampleGracenoteApiKey() {
  if (cachedExampleGracenoteKey !== undefined) {
    return cachedExampleGracenoteKey;
  }

  const exampleEnvPath = path.resolve(process.cwd(), ".env.example");
  if (!fs.existsSync(exampleEnvPath)) {
    cachedExampleGracenoteKey = null;
    return cachedExampleGracenoteKey;
  }

  const contents = fs.readFileSync(exampleEnvPath, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const [key, ...rest] = trimmed.split("=");
    if (key.trim() !== "GRACENOTE_API_KEY") {
      continue;
    }

    const rawValue = rest.join("=").trim();
    if (!rawValue) {
      cachedExampleGracenoteKey = null;
      return cachedExampleGracenoteKey;
    }

    cachedExampleGracenoteKey = rawValue.replace(/^"(.*)"$/, "$1");
    return cachedExampleGracenoteKey;
  }

  cachedExampleGracenoteKey = null;
  return cachedExampleGracenoteKey;
}

function getClientConfig() {
  const env = getServerEnv();

  if (!env.GRACENOTE_API_KEY) {
    throw new Error("GRACENOTE_API_KEY is required for Phase 1 syncs.");
  }

  const examplePlaceholder = getExampleGracenoteApiKey();
  if (examplePlaceholder && env.GRACENOTE_API_KEY === examplePlaceholder) {
    throw new Error(
      "Phase 1 sync cannot run while GRACENOTE_API_KEY still matches the placeholder in .env.example. Copy .env.example to .env and replace GRACENOTE_API_KEY with the key provided by Gracenote.",
    );
  }

  const base = env.GRACENOTE_BASE_URL.endsWith("/")
    ? env.GRACENOTE_BASE_URL
    : `${env.GRACENOTE_BASE_URL}/`;

  return {
    apiKey: env.GRACENOTE_API_KEY,
    baseUrl: base,
  };
}

export class GracenoteRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: string,
  ) {
    super(message);
    this.name = "GracenoteRequestError";
  }
}

export function isGracenoteRequestNotAuthorizedError(
  error: unknown,
): error is GracenoteRequestError {
  return (
    error instanceof GracenoteRequestError &&
    error.status === 403 &&
    error.body.toLowerCase().includes("not authorized")
  );
}

async function gracenoteGet<T>(
  path: string,
  params: Record<string, string | number | undefined>,
) {
  const { apiKey, baseUrl } = getClientConfig();
  const url = new URL(path, baseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    let message = `Gracenote request failed (${response.status}): ${body}`;
    if (response.status === 403) {
      message +=
        " Confirm the GRACENOTE_API_KEY in .env matches the key issued to your account and that the credential has access to the endpoint you are calling.";
    }
    throw new GracenoteRequestError(response.status, message, body);
  }

  return (await response.json()) as T;
}

function normalizeMovieSeedFromGracenote(raw: RawGracenoteMovie): NormalizedMovieSeed {
  const normalizedReleaseDate = normalizeReleaseDate(raw.releaseDate ?? undefined);

  return {
    provider: "gracenote",
    tmsId: raw.tmsId ?? null,
    rootId: raw.rootId ? String(raw.rootId) : null,
    title: raw.title.trim(),
    normalizedTitle: normalizeTitle(raw.title),
    releaseYear: raw.releaseYear ?? parseReleaseYear(normalizedReleaseDate ?? raw.releaseDate ?? undefined),
    releaseDate: normalizedReleaseDate,
    entityType: raw.entityType ?? "Movie",
    subType: raw.subType ?? null,
    shortDescription: raw.shortDescription ?? null,
    longDescription: raw.longDescription ?? null,
    runtimeMinutes: runtimeIsoToMinutes(raw.runTime),
    posterUrl: raw.preferredImage?.uri ?? null,
    raw,
  };
}

export function normalizeGracenoteTheatre(raw: RawGracenoteTheatre): NormalizedTheatre {
  const theatre: NormalizedTheatre = {
    provider: "gracenote",
    externalId: String(raw.id),
    externalType: "theatreId",
    name: raw.name.trim(),
    chainName: raw.chain ?? null,
    address1: raw.address1 ?? null,
    address2: raw.address2 ?? null,
    city: raw.city ?? null,
    state: raw.state ?? null,
    postalCode: normalizePostalCode(raw.postalCode) ?? null,
    countryCode: raw.country ?? "USA",
    latitude: raw.lat != null ? Number(raw.lat) : null,
    longitude: raw.lng != null ? Number(raw.lng) : null,
    phone: raw.phone ?? null,
    timeZone: raw.timeZone ?? null,
    identityKey: "",
    raw,
  };

  theatre.identityKey = normalizeTheatreIdentityKey(theatre);
  return theatre;
}

export function normalizeGracenoteShowings(rawMovies: RawGracenoteMovie[]) {
  const today = new Date().toISOString().slice(0, 10);
  const normalized: NormalizedShowing[] = [];

  for (const rawMovie of rawMovies) {
    const movie = normalizeMovieSeedFromGracenote(rawMovie);

    for (const rawShowtime of rawMovie.showtimes ?? []) {
      const theatre: NormalizedTheatre = {
        provider: "gracenote",
        externalId: String(rawShowtime.theatre.id),
        externalType: "theatreId",
        name: rawShowtime.theatre.name.trim(),
        chainName: null,
        address1: null,
        address2: null,
        city: null,
        state: null,
        postalCode: null,
        countryCode: "USA",
        latitude: null,
        longitude: null,
        phone: null,
        timeZone: null,
        identityKey: "",
        raw: rawShowtime.theatre,
      };

      theatre.identityKey = normalizeTheatreIdentityKey(theatre);

      const businessDate = businessDateFromIso(rawShowtime.dateTime);

      normalized.push({
        provider: "gracenote",
        movie,
        theatre,
        startAtLocal: rawShowtime.dateTime,
        businessDate,
        qualities: rawShowtime.quals ?? null,
        ticketUrl: rawShowtime.ticketURI ?? null,
        isBargain: Boolean(rawShowtime.barg),
        isAdvanceTicket: Boolean(rawShowtime.ticketURI) && businessDate > today,
        raw: rawShowtime,
      });
    }
  }

  return normalized;
}

export function normalizeGracenoteFutureReleases(
  rawMovies: RawGracenoteFutureRelease[],
): NormalizedFutureRelease[] {
  const normalized: NormalizedFutureRelease[] = [];

  for (const rawMovie of rawMovies) {
    const movie = normalizeMovieSeedFromGracenote(rawMovie);

    for (const release of rawMovie.releases ?? []) {
      const futureReleaseDateInput = release.date ?? movie.releaseDate ?? undefined;
      const normalizedFutureReleaseDate = normalizeReleaseDate(futureReleaseDateInput);
      const futureReleaseYear =
        (normalizedFutureReleaseDate ? parseReleaseYear(normalizedFutureReleaseDate) : null) ??
        movie.releaseYear ??
        null;

      normalized.push({
        provider: "gracenote",
        movie: {
          ...movie,
          releaseDate: normalizedFutureReleaseDate,
          releaseYear: futureReleaseYear,
        },
        releaseCountry: release.country ?? "USA",
        releaseType: release.type ?? null,
        distributorNames:
          release.distributors
            ?.map((distributor) => distributor.name)
            .filter((name): name is string => Boolean(name)) ?? [],
        raw: release,
      });
    }
  }

  return normalized;
}

export async function getTheatresByZip(input: {
  zip: string;
  radiusMiles?: number;
  numTheatres?: number;
}) {
  const response = await gracenoteGet<RawGracenoteTheatre[]>("theatres", {
    zip: input.zip,
    radius: input.radiusMiles ?? 25,
    units: "mi",
    numTheatres: input.numTheatres ?? 100,
  });

  return response.map(normalizeGracenoteTheatre);
}

export async function getAllShowingsByZip(input: {
  zip: string;
  startDate: string;
  numDays?: number;
  radiusMiles?: number;
}) {
  const response = await gracenoteGet<RawGracenoteMovie[]>("movies/showings", {
    zip: input.zip,
    startDate: input.startDate,
    numDays: input.numDays ?? 7,
    radius: input.radiusMiles ?? 25,
    units: "mi",
  });

  return normalizeGracenoteShowings(response);
}

export async function getMovieShowtimesByZip(input: {
  movieId: string;
  zip: string;
  startDate: string;
  numDays?: number;
  radiusMiles?: number;
}) {
  const response = await gracenoteGet<RawGracenoteMovie[]>(
    `movies/${encodeURIComponent(input.movieId)}/showings`,
    {
      zip: input.zip,
      startDate: input.startDate,
      numDays: input.numDays ?? 7,
      radius: input.radiusMiles ?? 25,
      units: "mi",
    },
  );

  return normalizeGracenoteShowings(response);
}

export async function getFutureReleases(input: {
  releaseDate: string;
  numDays?: number;
  country?: "USA" | "CAN";
}) {
  const response = await gracenoteGet<RawGracenoteFutureRelease[]>(
    "movies/futureReleases",
    {
      releaseDate: input.releaseDate,
      numDays: input.numDays ?? 60,
      country: input.country ?? "USA",
    },
  );

  return normalizeGracenoteFutureReleases(response);
}
