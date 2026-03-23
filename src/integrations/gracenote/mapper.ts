import { businessDateFromIso, runtimeIsoToMinutes } from "@/modules/availability/normalize";
import type {
  NormalizedFutureRelease,
  NormalizedShowing,
} from "@/modules/availability/types";
import {
  normalizeReleaseDate,
  normalizeTitle,
  parseReleaseYear,
} from "@/modules/catalog/normalize";
import type { NormalizedMovieSeed } from "@/modules/catalog/types";
import { normalizePostalCode } from "@/modules/locations/normalize";
import { normalizeTheatreIdentityKey } from "@/modules/theatres/normalize";
import type { NormalizedTheatre } from "@/modules/theatres/types";
import type {
  RawGracenoteFutureRelease,
  RawGracenoteMovie,
  RawGracenoteTheatre,
} from "@/integrations/gracenote/types";

export function normalizeMovieSeedFromGracenote(
  raw: RawGracenoteMovie,
): NormalizedMovieSeed {
  const normalizedReleaseDate = normalizeReleaseDate(raw.releaseDate ?? undefined);

  return {
    provider: "gracenote",
    tmsId: raw.tmsId ?? null,
    rootId: raw.rootId ? String(raw.rootId) : null,
    title: raw.title.trim(),
    normalizedTitle: normalizeTitle(raw.title),
    releaseYear:
      raw.releaseYear ??
      parseReleaseYear(normalizedReleaseDate ?? raw.releaseDate ?? undefined),
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

export function normalizeGracenoteTheatre(
  raw: RawGracenoteTheatre,
): NormalizedTheatre {
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

export function normalizeGracenoteShowings(
  rawMovies: RawGracenoteMovie[],
): NormalizedShowing[] {
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
        (normalizedFutureReleaseDate
          ? parseReleaseYear(normalizedFutureReleaseDate)
          : null) ??
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
