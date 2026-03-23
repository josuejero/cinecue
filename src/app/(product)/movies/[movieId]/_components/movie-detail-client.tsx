"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarExportButton } from "./calendar-export-button";
import { FavoriteTheatreButton } from "./favorite-theatre-button";
import { StatusBadge } from "@/shared/ui/status-badge";
import {
  ActionAnchor,
  ActionButton,
  ActionLink,
  ArrowLeftIcon,
  EmptyState,
  MetaPill,
  Notice,
  Panel,
  PosterArt,
  SectionHeading,
  SelectInput,
} from "@/shared/ui/ui";
import { readJson } from "@/shared/utils/http-client";
import { formatDate, formatDateTime } from "@/modules/availability/domain/format";

type SavedLocation = {
  userLocationId: string;
  locationId: string;
  normalizedKey: string;
  postalCode: string | null;
  radiusMiles: number;
  label: string;
  isDefault: boolean;
};

type MovieDetailResponse = {
  location: SavedLocation;
  favoriteTheatreIds: string[];
  calendarExportUrl: string | null;
  movie: {
    movieId: string;
    title: string;
    releaseYear: number | null;
    releaseDate: string | null;
    entityType: string;
    subType: string | null;
    shortDescription: string | null;
    longDescription: string | null;
    runtimeMinutes: number | null;
    posterUrl: string | null;
    isFollowed: boolean;
    localStatus: {
      status: string;
      nextShowingAt: string | null;
      firstShowingAt: string | null;
      lastShowingAt: string | null;
      theatreCount: number;
      statusChangedAt: string | null;
    } | null;
    nextShowings: Array<{
      showtimeId: string;
      startAtLocal: string;
      businessDate: string;
      qualities: string | null;
      ticketUrl: string | null;
      isAdvanceTicket: boolean;
      theatre: {
        theatreId: string;
        name: string;
        address1: string | null;
        city: string | null;
        state: string | null;
        postalCode: string | null;
      };
    }>;
    nearbyTheatres: Array<{
      theatreId: string;
      name: string;
      address1: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
      nextShowingAt: string | null;
      upcomingShowtimeCount: number;
    }>;
  };
};

type LocationsResponse = {
  locations: SavedLocation[];
};

function formatRuntime(runtimeMinutes: number | null) {
  if (!runtimeMinutes) {
    return null;
  }

  const hours = Math.floor(runtimeMinutes / 60);
  const minutes = runtimeMinutes % 60;

  if (!hours) {
    return `${minutes} min`;
  }

  if (!minutes) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function MovieDetailClient(input: {
  movieId: string;
  requestedLocationId?: string | null;
}) {
  const { movieId, requestedLocationId = null } = input;
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [detail, setDetail] = useState<MovieDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentLocation =
    locations.find((location) => location.locationId === selectedLocationId) ?? null;

  const loadLocations = useCallback(async () => {
    const data = await readJson<LocationsResponse>("/api/locations");
    setLocations(data.locations);

    if (!data.locations.length) {
      setSelectedLocationId("");
      return;
    }

    const requested = requestedLocationId
      ? data.locations.find((location) => location.locationId === requestedLocationId)
      : undefined;

    const nextLocation =
      requested ?? data.locations.find((location) => location.isDefault) ?? data.locations[0];

    setSelectedLocationId(nextLocation.locationId);
  }, [requestedLocationId]);

  const loadDetail = useCallback(
    async (locationId: string) => {
      const data = await readJson<MovieDetailResponse>(
        `/api/movies/${movieId}?locationId=${encodeURIComponent(locationId)}`,
      );
      setDetail(data);
    },
    [movieId],
  );

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        await loadLocations();
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : "Failed to load locations.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [loadLocations]);

  useEffect(() => {
    if (!selectedLocationId) {
      return;
    }

    void (async () => {
      try {
        setLoading(true);
        setError(null);
        await loadDetail(selectedLocationId);
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : "Failed to load movie detail.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [loadDetail, selectedLocationId]);

  async function handleToggleFollow() {
    if (!detail || !selectedLocationId) {
      return;
    }

    try {
      setBusy(true);
      setError(null);

      if (detail.movie.isFollowed) {
        await readJson(
          `/api/follows/${movieId}?locationId=${encodeURIComponent(selectedLocationId)}`,
          { method: "DELETE" },
        );
      } else {
        await readJson("/api/follows", {
          method: "POST",
          body: JSON.stringify({
            movieId,
            locationId: selectedLocationId,
          }),
        });
      }

      await loadDetail(selectedLocationId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to update follow.");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !detail) {
    return (
      <Panel className="p-8" tone="soft">
        <p className="text-sm text-[color:var(--foreground-muted)]">Loading movie detail...</p>
      </Panel>
    );
  }

  if (!locations.length) {
    return (
      <EmptyState
        action={
          <ActionLink href="/dashboard" icon={<ArrowLeftIcon />} size="lg" variant="primary">
            Go to dashboard setup
          </ActionLink>
        }
        title="Save a ZIP code first"
      >
        Movie detail pages rely on a saved location so CineCue can resolve nearby theatres, showtimes, and the local status you actually care about.
      </EmptyState>
    );
  }

  if (!detail) {
    return <Notice tone="danger">{error ?? "Movie detail unavailable."}</Notice>;
  }

  const runtimeLabel = formatRuntime(detail.movie.runtimeMinutes);

  return (
    <div className="space-y-6">
      <Panel className="cine-enter overflow-hidden p-5 sm:p-7 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <PosterArt
            className="mx-auto h-[26rem] w-full max-w-sm lg:mx-0 lg:h-[33rem]"
            src={detail.movie.posterUrl}
            title={detail.movie.title}
          />

          <div className="space-y-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <SectionHeading
                  description={
                    detail.movie.longDescription ??
                    detail.movie.shortDescription ??
                    "CineCue will watch this title's local theatrical arc as theatres and showtimes change."
                  }
                  eyebrow="Movie detail"
                  title={detail.movie.title}
                />

                <div className="flex flex-wrap items-center gap-2.5">
                  <MetaPill>{detail.movie.releaseYear ?? "Year TBD"}</MetaPill>
                  <MetaPill>
                    {detail.movie.releaseDate
                      ? `Released ${formatDate(detail.movie.releaseDate)}`
                      : "Release date TBD"}
                  </MetaPill>
                  {runtimeLabel ? <MetaPill>{runtimeLabel}</MetaPill> : null}
                  {detail.movie.subType ? <MetaPill>{detail.movie.subType}</MetaPill> : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] xl:w-[21rem]">
                <label className="sr-only" htmlFor="movie-location">
                  Location
                </label>
                <SelectInput
                  id="movie-location"
                  onChange={(event) => setSelectedLocationId(event.target.value)}
                  value={selectedLocationId}
                >
                  {locations.map((location) => (
                    <option key={location.locationId} value={location.locationId}>
                      {location.label}
                    </option>
                  ))}
                </SelectInput>

                <ActionButton
                  disabled={busy}
                  onClick={() => {
                    void handleToggleFollow();
                  }}
                  size="lg"
                  variant={detail.movie.isFollowed ? "secondary" : "primary"}
                >
                  {busy ? "Working..." : detail.movie.isFollowed ? "Unfollow" : "Follow"}
                </ActionButton>

                {detail.calendarExportUrl ? (
                  <CalendarExportButton
                    className="sm:col-span-2"
                    href={detail.calendarExportUrl}
                    size="lg"
                  >
                    Export showtimes
                  </CalendarExportButton>
                ) : null}
              </div>
            </div>

            {detail.movie.localStatus ? (
              <Panel className="p-5 sm:p-6" tone="soft">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusBadge status={detail.movie.localStatus.status} />
                      <MetaPill>
                        {detail.movie.localStatus.theatreCount} theatre
                        {detail.movie.localStatus.theatreCount === 1 ? "" : "s"}
                      </MetaPill>
                    </div>
                    <p className="max-w-2xl text-sm leading-7 text-[color:var(--foreground-muted)]">
                      Viewing showtimes for {currentLocation?.label ?? detail.location.label}. CineCue refreshes this local status as screenings and ticket availability shift.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetaPill>Next showing {formatDateTime(detail.movie.localStatus.nextShowingAt)}</MetaPill>
                    <MetaPill>First seen {formatDateTime(detail.movie.localStatus.firstShowingAt)}</MetaPill>
                    <MetaPill>Last showing {formatDateTime(detail.movie.localStatus.lastShowingAt)}</MetaPill>
                    <MetaPill>Updated {formatDateTime(detail.movie.localStatus.statusChangedAt)}</MetaPill>
                  </div>
                </div>
              </Panel>
            ) : (
              <Notice tone="neutral">
                No local status row exists yet for this movie in the selected area.
              </Notice>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Panel className="p-6 sm:p-8">
          <SectionHeading
            description="The next showings CineCue currently knows about in the selected area."
            eyebrow="Showtimes"
            title="Next showings"
          />

          <div className="mt-6 space-y-4">
            {detail.movie.nextShowings.length ? (
              detail.movie.nextShowings.map((showing) => (
                <Panel key={showing.showtimeId} className="cine-hover-lift p-4 sm:p-5" tone="soft">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="font-display text-2xl tracking-[-0.03em] text-[color:var(--foreground)]">
                          {showing.theatre.name}
                        </p>
                        <p className="text-sm text-[color:var(--foreground-muted)]">
                          {[showing.theatre.address1, showing.theatre.city, showing.theatre.state]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <MetaPill>{formatDateTime(showing.startAtLocal)}</MetaPill>
                        {showing.qualities ? <MetaPill>{showing.qualities}</MetaPill> : null}
                        {showing.isAdvanceTicket ? <MetaPill>Advance ticket</MetaPill> : null}
                      </div>
                    </div>

                    {showing.ticketUrl ? (
                      <ActionAnchor
                        href={showing.ticketUrl}
                        rel="noreferrer"
                        size="sm"
                        target="_blank"
                        variant="primary"
                      >
                        Tickets
                      </ActionAnchor>
                    ) : null}
                  </div>
                </Panel>
              ))
            ) : (
              <Notice tone="neutral">
                No upcoming showtimes are currently stored for this movie in the selected area.
              </Notice>
            )}
          </div>
        </Panel>

        <Panel className="p-6 sm:p-8" tone="soft">
          <SectionHeading
            description="Nearby theatres that are currently carrying this movie in your selected market."
            eyebrow="Theatres"
            title="Nearby theatres"
          />

          <div className="mt-6 space-y-4">
            {detail.movie.nearbyTheatres.length ? (
              detail.movie.nearbyTheatres.map((theatre) => (
                <Panel key={theatre.theatreId} className="cine-hover-lift p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="font-display text-2xl tracking-[-0.03em] text-[color:var(--foreground)]">
                          {theatre.name}
                        </p>
                        <p className="text-sm leading-6 text-[color:var(--foreground-muted)]">
                          {[theatre.address1, theatre.city, theatre.state, theatre.postalCode]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <MetaPill>Next showing {formatDateTime(theatre.nextShowingAt)}</MetaPill>
                        <MetaPill>
                          {theatre.upcomingShowtimeCount} upcoming showtime
                          {theatre.upcomingShowtimeCount === 1 ? "" : "s"}
                        </MetaPill>
                      </div>
                    </div>

                    <FavoriteTheatreButton
                      initialFavorite={detail.favoriteTheatreIds.includes(theatre.theatreId)}
                      locationId={detail.location.locationId}
                      theatreId={theatre.theatreId}
                    />
                  </div>
                </Panel>
              ))
            ) : (
              <Notice tone="neutral">
                No nearby theatres are currently attached to this title in the selected area.
              </Notice>
            )}
          </div>
        </Panel>
      </div>

      {error ? <Notice tone="danger">{error}</Notice> : null}
    </div>
  );
}
