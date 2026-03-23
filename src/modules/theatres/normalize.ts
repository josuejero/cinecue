import type { NormalizedTheatre } from "@/modules/theatres/types";
import { normalizeTitle } from "@/modules/catalog/normalize";
import { normalizePostalCode } from "@/modules/locations/normalize";
import { collapseWhitespace } from "@/shared/utils/text";

export function normalizeAddress(parts: Array<string | null | undefined>) {
  return collapseWhitespace(
    parts
      .filter(Boolean)
      .join(" ")
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .toLowerCase(),
  );
}

export function normalizeTheatreIdentityKey(
  theatre: Pick<
    NormalizedTheatre,
    "name" | "address1" | "address2" | "city" | "state" | "postalCode" | "countryCode"
  >,
) {
  return [
    normalizeTitle(theatre.name),
    normalizeAddress([
      theatre.address1,
      theatre.address2,
      theatre.city,
      theatre.state,
      theatre.postalCode,
    ]),
    normalizePostalCode(theatre.postalCode) ?? "",
    (theatre.countryCode ?? "USA").toUpperCase(),
  ].join("|");
}
