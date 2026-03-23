export type SourceProvider = "gracenote" | "tmdb" | "imdb" | "app";

export interface NormalizedTheatre {
  provider: SourceProvider;
  externalId: string;
  externalType: string;
  name: string;
  chainName?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  timeZone?: string | null;
  identityKey: string;
  raw: unknown;
}

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

export interface NormalizedShowing {
  provider: SourceProvider;
  movie: NormalizedMovieSeed;
  theatre: NormalizedTheatre;
  startAtLocal: string;
  businessDate: string;
  qualities?: string | null;
  ticketUrl?: string | null;
  isBargain: boolean;
  isAdvanceTicket: boolean;
  raw: unknown;
}

export interface NormalizedFutureRelease {
  provider: SourceProvider;
  movie: NormalizedMovieSeed;
  releaseCountry: string;
  releaseType?: string | null;
  distributorNames: string[];
  raw: unknown;
}