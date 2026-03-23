import type { SourceProvider } from "@/shared/types/source-provider";

export interface NormalizedMovieSeed {
  provider: SourceProvider;
  tmsId?: string | null;
  rootId?: string | null;
  tmdbId?: string | null;
  imdbId?: string | null;
  title: string;
  normalizedTitle: string;
  releaseYear?: number | null;
  releaseDate?: string | null;
  entityType?: string | null;
  subType?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  runtimeMinutes?: number | null;
  posterUrl?: string | null;
  raw: unknown;
}
