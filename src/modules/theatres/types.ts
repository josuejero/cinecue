import type { SourceProvider } from "@/shared/types/source-provider";

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
