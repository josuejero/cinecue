import { getServerEnv } from "@/shared/infra/env";
import type { TmdbFindResponse, TmdbMovieDetails, TmdbSearchResponse } from "@/integrations/tmdb/types";

function getClientConfig() {
  const env = getServerEnv();

  if (!env.TMDB_READ_ACCESS_TOKEN && !env.TMDB_API_KEY) {
    throw new Error("TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY is required for TMDB calls.");
  }

  const base = env.TMDB_BASE_URL.endsWith("/")
    ? env.TMDB_BASE_URL
    : `${env.TMDB_BASE_URL}/`;

  return {
    baseUrl: base,
    token: env.TMDB_READ_ACCESS_TOKEN,
    apiKey: env.TMDB_API_KEY,
  };
}

async function tmdbGet<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
) {
  const { baseUrl, token, apiKey } = getClientConfig();
  const url = new URL(path, baseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  if (apiKey) {
    url.searchParams.set("api_key", apiKey);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TMDB request failed (${response.status}): ${body}`);
  }

  return (await response.json()) as T;
}

export async function searchTmdbMovies(query: string, year?: number) {
  const response = await tmdbGet<TmdbSearchResponse>("search/movie", {
    query,
    year,
    include_adult: "false",
  });

  return response.results ?? [];
}

export async function findTmdbMovieByImdbId(imdbId: string) {
  const response = await tmdbGet<TmdbFindResponse>(`find/${encodeURIComponent(imdbId)}`, {
    external_source: "imdb_id",
  });

  return response.movie_results?.[0] ?? null;
}

export async function getTmdbMovieDetails(movieId: number) {
  return tmdbGet<TmdbMovieDetails>(`movie/${movieId}`, {
    append_to_response: "external_ids,images",
  });
}

