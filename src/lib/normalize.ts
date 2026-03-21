import type { NormalizedTheatre } from "@/lib/providers/types";

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeTitle(value: string) {
  return collapseWhitespace(
    value
      .normalize("NFKD")
      .replace(/['’]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .toLowerCase(),
  );
}

export function normalizePostalCode(value?: string | null) {
  if (!value) {
    return null;
  }

  return value.replace(/\s+/g, "").toUpperCase();
}

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

export function runtimeIsoToMinutes(value?: string | null) {
  if (!value) {
    return null;
  }

  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(value);
  if (!match) {
    return null;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  return hours * 60 + minutes;
}

export function businessDateFromIso(localDateTime: string) {
  return localDateTime.slice(0, 10);
}

export function parseReleaseYear(dateString?: string | null) {
  if (!dateString) {
    return null;
  }

  const year = Number(dateString.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

export function normalizeReleaseDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(`${trimmed}T00:00:00Z`);

  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return trimmed;
}

export function tmdbPosterUrl(path?: string | null, size = "w500") {
  if (!path) {
    return null;
  }

  return `https://image.tmdb.org/t/p/${size}${path}`;
}
