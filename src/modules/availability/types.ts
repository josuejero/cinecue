import type { NormalizedMovieSeed } from "@/modules/catalog/types";
import type { NormalizedTheatre } from "@/modules/theatres/types";
import type { SourceProvider } from "@/shared/types/source-provider";

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
