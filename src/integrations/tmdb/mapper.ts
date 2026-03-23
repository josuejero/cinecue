import { normalizeReleaseDate, normalizeTitle, parseReleaseYear, tmdbPosterUrl } from "@/modules/catalog/normalize";
import type { NormalizedMovieSeed } from "@/modules/catalog/types";
import type { TmdbMovieDetails } from "@/integrations/tmdb/types";

export function mapTmdbDetailsToMovieSeed(details: TmdbMovieDetails): NormalizedMovieSeed {
  const title = details.title?.trim() || details.original_title?.trim() || `TMDB ${details.id}`;
  const normalizedReleaseDate = normalizeReleaseDate(details.release_date ?? undefined);

  return {
    provider: "tmdb",
    tmdbId: String(details.id),
    imdbId: details.external_ids?.imdb_id ?? null,
    title,
    normalizedTitle: normalizeTitle(title),
    releaseYear: parseReleaseYear(normalizedReleaseDate ?? undefined),
    releaseDate: normalizedReleaseDate,
    entityType: "Movie",
    subType: "Feature Film",
    shortDescription: details.overview ?? null,
    longDescription: details.overview ?? null,
    runtimeMinutes: details.runtime ?? null,
    posterUrl: tmdbPosterUrl(details.poster_path),
    raw: details,
  };
}
