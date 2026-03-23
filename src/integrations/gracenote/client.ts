import fs from "fs";
import path from "path";

import { getServerEnv } from "@/shared/infra/env";
import {
  normalizeGracenoteFutureReleases,
  normalizeGracenoteShowings,
  normalizeGracenoteTheatre,
} from "@/integrations/gracenote/mapper";
import type { RawGracenoteFutureRelease, RawGracenoteMovie, RawGracenoteTheatre } from "@/integrations/gracenote/types";

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
    throw new Error("GRACENOTE_API_KEY is required for availability syncs.");
  }

  const examplePlaceholder = getExampleGracenoteApiKey();
  if (examplePlaceholder && env.GRACENOTE_API_KEY === examplePlaceholder) {
    throw new Error(
      "Availability sync cannot run while GRACENOTE_API_KEY still matches the placeholder in .env.example. Copy .env.example to .env and replace GRACENOTE_API_KEY with the key provided by Gracenote.",
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
