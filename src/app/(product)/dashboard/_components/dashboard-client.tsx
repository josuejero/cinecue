"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { InstallAppButton } from "../../_components/install-app-button";
import { StatusBadge } from "@/shared/ui/status-badge";
import {
  ActionButton,
  ActionLink,
  ArrowRightIcon,
  Dot,
  EmptyState,
  Eyebrow,
  MapPinIcon,
  MetaPill,
  Notice,
  Panel,
  PosterArt,
  PulseIcon,
  SearchIcon,
  SectionHeading,
  SelectInput,
  SparkIcon,
  TextInput,
  cx,
} from "@/shared/ui/ui";
import { readJson } from "@/shared/utils/http-client";
import {
  describeAvailabilityChange,
  formatDate,
  formatDateTime,
} from "@/modules/availability/domain/format";

type SavedLocation = {
  userLocationId: string;
  locationId: string;
  normalizedKey: string;
  postalCode: string | null;
  radiusMiles: number;
  label: string;
  isDefault: boolean;
};

type DashboardMovie = {
  movieId: string;
  title: string;
  releaseYear: number | null;
  releaseDate: string | null;
  posterUrl: string | null;
  shortDescription: string | null;
  followedAt: string;
  nextShowingAt: string | null;
  firstShowingAt: string | null;
  lastShowingAt: string | null;
  theatreCount: number;
  statusChangedAt: string | null;
};

type DashboardResponse = {
  location: SavedLocation;
  totalFollows: number;
  sections: Array<{
    status: string;
    label: string;
    items: DashboardMovie[];
  }>;
};

type AvailabilityChange = {
  id: string;
  changedAt: string;
  previousStatus: string | null;
  newStatus: string;
  previousTheatreCount: number | null;
  newTheatreCount: number;
  previousNextShowingAt: string | null;
  newNextShowingAt: string | null;
  movieId: string;
  title: string;
  posterUrl: string | null;
};

type LocationsResponse = {
  locations: SavedLocation[];
};

type SearchResult = {
  movieId: string;
  title: string;
  releaseYear: number | null;
  releaseDate: string | null;
  posterUrl: string | null;
  shortDescription: string | null;
  isFollowed: boolean;
};

type SearchResponse = {
  results: SearchResult[];
};

type ChangesResponse = {
  changes: AvailabilityChange[];
};

function liveStateClassName(state: "idle" | "connecting" | "connected" | "reconnecting") {
  switch (state) {
    case "connected":
      return "border-[color:rgba(66,134,97,0.18)] bg-[color:rgba(232,247,239,0.92)] text-[color:var(--emerald-deep)]";
    case "reconnecting":
      return "border-[color:rgba(174,119,44,0.2)] bg-[color:rgba(255,244,225,0.92)] text-[color:var(--amber-deep)]";
    case "connecting":
      return "border-[color:rgba(84,105,146,0.18)] bg-[color:rgba(235,241,252,0.92)] text-[color:var(--navy-deep)]";
    default:
      return "border-[color:var(--line)] bg-white/70 text-[color:var(--foreground-muted)]";
  }
}

function liveStateLabel(state: "idle" | "connecting" | "connected" | "reconnecting") {
  switch (state) {
    case "connected":
      return "Live updates on";
    case "reconnecting":
      return "Reconnecting";
    case "connecting":
      return "Connecting";
    default:
      return "Live updates idle";
  }
}

function SearchResultCard({
  busy,
  locationId,
  movie,
  onToggleFollow,
}: {
  busy: boolean;
  locationId: string;
  movie: SearchResult;
  onToggleFollow: (movieId: string, isFollowed: boolean) => Promise<void>;
}) {
  return (
    <Panel className="cine-enter-delay cine-hover-lift p-3 sm:p-4" tone="soft">
      <div className="flex flex-col gap-4 sm:flex-row">
        <PosterArt
          className="h-40 w-full shrink-0 sm:h-44 sm:w-32"
          src={movie.posterUrl}
          title={movie.title}
        />

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <Link
                  className="font-display text-2xl tracking-[-0.03em] text-[color:var(--foreground)] transition hover:text-[color:var(--oxblood)]"
                  href={`/movies/${movie.movieId}?locationId=${encodeURIComponent(locationId)}`}
                >
                  {movie.title}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--foreground-muted)]">
                  <span>{movie.releaseYear ? `${movie.releaseYear}` : "Release year TBD"}</span>
                  <Dot />
                  <span>
                    {movie.releaseDate ? formatDate(movie.releaseDate) : "Release date TBD"}
                  </span>
                </div>
              </div>
              <ActionButton
                disabled={busy}
                onClick={() => {
                  void onToggleFollow(movie.movieId, movie.isFollowed);
                }}
                size="sm"
                variant={movie.isFollowed ? "secondary" : "primary"}
              >
                {busy ? "Working..." : movie.isFollowed ? "Unfollow" : "Follow"}
              </ActionButton>
            </div>

            {movie.shortDescription ? (
              <p className="line-clamp-3 max-w-2xl text-sm leading-7 text-[color:var(--foreground-muted)]">
                {movie.shortDescription}
              </p>
            ) : null}
          </div>

          <ActionLink
            href={`/movies/${movie.movieId}?locationId=${encodeURIComponent(locationId)}`}
            iconAfter={<ArrowRightIcon />}
            size="sm"
            variant="ghost"
          >
            Open local detail
          </ActionLink>
        </div>
      </div>
    </Panel>
  );
}

function FollowedMovieCard({
  busy,
  locationId,
  movie,
  status,
  onUnfollow,
}: {
  busy: boolean;
  locationId: string;
  movie: DashboardMovie;
  status: string;
  onUnfollow: (movieId: string) => Promise<void>;
}) {
  return (
    <Panel className="cine-hover-lift overflow-hidden p-3 sm:p-4" tone="default">
      <div className="flex flex-col gap-4 sm:flex-row">
        <PosterArt
          className="h-44 w-full shrink-0 sm:h-48 sm:w-34"
          src={movie.posterUrl}
          title={movie.title}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <StatusBadge status={status} />
                <MetaPill>
                  {movie.releaseYear ? `${movie.releaseYear}` : "Year TBD"}
                </MetaPill>
              </div>
              <div className="space-y-2">
                <Link
                  className="font-display text-2xl tracking-[-0.03em] text-[color:var(--foreground)] transition hover:text-[color:var(--oxblood)]"
                  href={`/movies/${movie.movieId}?locationId=${encodeURIComponent(locationId)}`}
                >
                  {movie.title}
                </Link>
                {movie.shortDescription ? (
                  <p className="line-clamp-3 max-w-3xl text-sm leading-7 text-[color:var(--foreground-muted)]">
                    {movie.shortDescription}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ActionLink
                href={`/movies/${movie.movieId}?locationId=${encodeURIComponent(locationId)}`}
                size="sm"
                variant="secondary"
              >
                Detail
              </ActionLink>
              <ActionButton
                disabled={busy}
                onClick={() => {
                  void onUnfollow(movie.movieId);
                }}
                size="sm"
                variant="ghost"
              >
                {busy ? "Working..." : "Unfollow"}
              </ActionButton>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetaPill>Next: {formatDateTime(movie.nextShowingAt)}</MetaPill>
            <MetaPill>
              Theatres: {movie.theatreCount} nearby
            </MetaPill>
            <MetaPill>Status changed: {formatDateTime(movie.statusChangedAt)}</MetaPill>
            <MetaPill>Followed: {formatDate(movie.followedAt)}</MetaPill>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ChangeItem({
  change,
  locationId,
}: {
  change: AvailabilityChange;
  locationId: string;
}) {
  return (
    <Link
      className="cine-hover-lift block rounded-[calc(var(--radius-card)+2px)] border border-[color:var(--line)] bg-white/72 p-3 shadow-[var(--shadow-soft)] transition hover:border-[color:var(--accent)]"
      href={`/movies/${change.movieId}?locationId=${encodeURIComponent(locationId)}`}
    >
      <div className="flex items-start gap-3">
        <PosterArt
          className="h-24 w-18 shrink-0 rounded-[20px]"
          src={change.posterUrl}
          title={change.title}
        />
        <div className="min-w-0 space-y-2">
          <p className="font-semibold text-[color:var(--foreground)]">{change.title}</p>
          <p className="text-sm leading-6 text-[color:var(--foreground-muted)]">
            {describeAvailabilityChange(change.previousStatus, change.newStatus)}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[color:var(--foreground-soft)]">
            <span>{formatDateTime(change.changedAt)}</span>
            <Dot />
            <span>{change.newTheatreCount} theatres</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function DashboardClient() {
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [changes, setChanges] = useState<AvailabilityChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingZip, setSavingZip] = useState(false);
  const [zip, setZip] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [busyMovieIds, setBusyMovieIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<
    "idle" | "connecting" | "connected" | "reconnecting"
  >("idle");
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string | null>(null);
  const searchQueryRef = useRef(searchQuery);

  const currentLocation =
    locations.find((location) => location.locationId === selectedLocationId) ?? null;

  const loadLocations = useCallback(async (preferredLocationId?: string | null) => {
    const data = await readJson<LocationsResponse>("/api/locations");
    setLocations(data.locations);

    if (!data.locations.length) {
      setSelectedLocationId("");
      setDashboard(null);
      setChanges([]);
      return "";
    }

    const explicit = preferredLocationId
      ? data.locations.find((location) => location.locationId === preferredLocationId)
      : undefined;

    const nextLocation =
      explicit ?? data.locations.find((location) => location.isDefault) ?? data.locations[0];

    setSelectedLocationId(nextLocation.locationId);
    return nextLocation.locationId;
  }, []);

  const loadDashboardBundle = useCallback(
    async (locationId: string, options?: { refreshDashboard?: boolean }) => {
      const dashboardQuery = new URLSearchParams({ locationId });

      if (options?.refreshDashboard) {
        dashboardQuery.set("refresh", "true");
      }

      const [dashboardData, changeData] = await Promise.all([
        readJson<DashboardResponse>(`/api/dashboard?${dashboardQuery.toString()}`),
        readJson<ChangesResponse>(
          `/api/availability/changes?locationId=${encodeURIComponent(locationId)}&limit=12`,
        ),
      ]);

      setDashboard(dashboardData);
      setChanges(changeData.changes);
    },
    [],
  );

  const runSearch = useCallback(async (query: string, locationId: string) => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);

    try {
      const data = await readJson<SearchResponse>(
        `/api/search/movies?q=${encodeURIComponent(trimmed)}&locationId=${encodeURIComponent(locationId)}&limit=10`,
      );
      setSearchResults(data.results);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const refreshAll = useCallback(
    async (locationId: string, query?: string, options?: { refreshDashboard?: boolean }) => {
      const nextQuery = query ?? searchQueryRef.current;
      await loadDashboardBundle(locationId, options);

      if (nextQuery.trim().length >= 2) {
        await runSearch(nextQuery, locationId);
      }
    },
    [loadDashboardBundle, runSearch],
  );

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

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
      setLiveState("idle");
      return;
    }

    void (async () => {
      try {
        setLoading(true);
        setError(null);
        await loadDashboardBundle(selectedLocationId);
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : "Failed to load dashboard.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [loadDashboardBundle, selectedLocationId]);

  useEffect(() => {
    if (!selectedLocationId) {
      return;
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void runSearch(trimmed, selectedLocationId).catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : "Movie search failed.");
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [runSearch, searchQuery, selectedLocationId]);

  useEffect(() => {
    if (!selectedLocationId) {
      return;
    }

    setLiveState("connecting");

    const source = new EventSource(
      `/api/events?locationId=${encodeURIComponent(selectedLocationId)}`,
    );

    const onConnected = () => {
      setLiveState("connected");
    };

    const onRefresh = () => {
      setLiveState("connected");
      setLastLiveUpdate(new Date().toISOString());
      void refreshAll(selectedLocationId, undefined, {
        refreshDashboard: true,
      }).catch((nextError) => {
        setError(
          nextError instanceof Error ? nextError.message : "Failed to refresh dashboard.",
        );
      });
    };

    source.addEventListener("connected", onConnected);
    source.addEventListener("dashboard-refresh", onRefresh);
    source.onerror = () => {
      setLiveState("reconnecting");
    };

    return () => {
      source.removeEventListener("connected", onConnected);
      source.removeEventListener("dashboard-refresh", onRefresh);
      source.close();
      setLiveState("idle");
    };
  }, [refreshAll, selectedLocationId]);

  async function handleSaveZip(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!zip.trim()) {
      return;
    }

    try {
      setSavingZip(true);
      setError(null);

      await readJson<{ location: SavedLocation }>("/api/locations", {
        method: "POST",
        body: JSON.stringify({
          postalCode: zip.trim(),
          makeDefault: true,
        }),
      });

      setZip("");
      await loadLocations();
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to save ZIP code.",
      );
    } finally {
      setSavingZip(false);
    }
  }

  async function handleToggleFollow(movieId: string, isFollowed: boolean) {
    if (!selectedLocationId) {
      return;
    }

    try {
      setBusyMovieIds((current) => [...current, movieId]);
      setError(null);

      if (isFollowed) {
        await readJson(
          `/api/follows/${movieId}?locationId=${encodeURIComponent(selectedLocationId)}`,
          {
            method: "DELETE",
          },
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

      await refreshAll(selectedLocationId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to update follow.");
    } finally {
      setBusyMovieIds((current) => current.filter((id) => id !== movieId));
    }
  }

  const visibleSections =
    dashboard?.sections.filter((section) => section.items.length > 0) ?? [];

  if (loading && !locations.length) {
    return (
      <Panel className="p-8" tone="soft">
        <p className="text-sm text-[color:var(--foreground-muted)]">Loading your dashboard...</p>
      </Panel>
    );
  }

  if (!locations.length) {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel className="cine-enter overflow-hidden p-8 sm:p-10">
          <div className="relative space-y-6">
            <SectionHeading
              description="CineCue starts with one saved ZIP so every movie, theatre, change feed, and alert is anchored to a real local market."
              eyebrow="First things first"
              title="Save a ZIP code to turn on local movie tracking"
            />

            <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={handleSaveZip}>
              <div className="space-y-2">
                <label className="sr-only" htmlFor="dashboard-zip">
                  ZIP code
                </label>
                <TextInput
                  id="dashboard-zip"
                  onChange={(event) => setZip(event.target.value)}
                  placeholder="Enter ZIP code"
                  value={zip}
                />
              </div>
              <ActionButton
                disabled={savingZip}
                icon={<MapPinIcon />}
                size="lg"
                type="submit"
                variant="primary"
              >
                {savingZip ? "Saving..." : "Save ZIP"}
              </ActionButton>
            </form>

            {error ? <Notice tone="danger">{error}</Notice> : null}
          </div>
        </Panel>

        <Panel className="cine-enter-delay p-8 sm:p-10" tone="contrast">
          <div className="space-y-5">
            <Eyebrow className="text-white/55">What unlocks next</Eyebrow>
            <h3 className="font-display text-3xl tracking-[-0.04em] text-white">
              A calmer, smarter release radar.
            </h3>
            <div className="space-y-3 text-sm leading-7 text-white/78">
              <p>Follow upcoming titles, watch local status shift, and keep an eye on the exact theatres that matter to you.</p>
              <p>Once your first location is saved, CineCue activates the live dashboard, detail pages, install flow, and notification controls around that market.</p>
            </div>
            <div className="grid gap-3 text-sm text-white/78">
              {[
                "Poster-led search results for faster following",
                "Availability sections grouped by local status",
                "Recent activity feed with live refresh",
                "Settings tuned to location and alert relevance",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[calc(var(--radius-card)-2px)] border border-white/10 bg-white/6 px-4 py-3"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.62fr]">
      <div className="space-y-6">
        <Panel className="cine-enter overflow-hidden p-6 sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Eyebrow>Your area</Eyebrow>
                <span
                  className={cx(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em]",
                    liveStateClassName(liveState),
                  )}
                >
                  <PulseIcon />
                  {liveStateLabel(liveState)}
                </span>
              </div>

              <div className="space-y-3">
                <h2 className="font-display text-4xl tracking-[-0.045em] text-[color:var(--foreground)] sm:text-5xl">
                  {currentLocation?.label}
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-[color:var(--foreground-muted)] sm:text-base">
                  CineCue is currently tuned to{" "}
                  {currentLocation?.postalCode
                    ? `ZIP ${currentLocation.postalCode}`
                    : currentLocation?.normalizedKey}
                  . Track watched titles, theatre spread, and the next change that actually matters.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <MetaPill>
                  <MapPinIcon />
                  {currentLocation?.radiusMiles} mile radius
                </MetaPill>
                <MetaPill>
                  <SparkIcon />
                  {dashboard?.totalFollows ?? 0} followed title
                  {(dashboard?.totalFollows ?? 0) === 1 ? "" : "s"}
                </MetaPill>
                {lastLiveUpdate ? (
                  <MetaPill>Last refresh {formatDateTime(lastLiveUpdate)}</MetaPill>
                ) : null}
              </div>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_auto] xl:max-w-xl">
              <div className="space-y-2">
                <label className="sr-only" htmlFor="location-picker">
                  Saved locations
                </label>
                <SelectInput
                  id="location-picker"
                  onChange={(event) => setSelectedLocationId(event.target.value)}
                  value={selectedLocationId}
                >
                  {locations.map((location) => (
                    <option key={location.locationId} value={location.locationId}>
                      {location.label}
                    </option>
                  ))}
                </SelectInput>
              </div>

              <InstallAppButton size="lg" variant="secondary">
                Install CineCue
              </InstallAppButton>

              <form
                className="sm:col-span-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                onSubmit={handleSaveZip}
              >
                <label className="sr-only" htmlFor="add-zip">
                  Add another ZIP code
                </label>
                <TextInput
                  id="add-zip"
                  onChange={(event) => setZip(event.target.value)}
                  placeholder="Add another ZIP code"
                  value={zip}
                />
                <ActionButton
                  disabled={savingZip}
                  size="lg"
                  type="submit"
                  variant="primary"
                >
                  {savingZip ? "Saving..." : "Add ZIP"}
                </ActionButton>
              </form>
            </div>
          </div>
        </Panel>

        <Panel className="cine-enter-delay p-6 sm:p-8" tone="soft">
          <SectionHeading
            description="Search against the current location and follow exactly the titles you want CineCue to watch."
            eyebrow="Search and follow"
            title="Find titles worth tracking"
          />

          <div className="mt-6 space-y-4">
            <div className="relative">
              <TextInput
                className="pl-12"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by movie title"
                value={searchQuery}
              />
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--foreground-soft)]">
                <SearchIcon />
              </div>
            </div>

            {searchQuery.trim().length >= 2 ? (
              <div className="space-y-3">
                {searchLoading ? (
                  <Notice tone="neutral">Searching your current market...</Notice>
                ) : searchResults.length ? (
                  searchResults.map((movie) => (
                    <SearchResultCard
                      key={movie.movieId}
                      busy={busyMovieIds.includes(movie.movieId)}
                      locationId={selectedLocationId}
                      movie={movie}
                      onToggleFollow={handleToggleFollow}
                    />
                  ))
                ) : (
                  <Notice tone="neutral">
                    No matching titles yet. Try a broader spelling or a more complete title.
                  </Notice>
                )}
              </div>
            ) : (
              <Notice tone="neutral">
                Start typing at least 2 characters to search this location.
              </Notice>
            )}
          </div>
        </Panel>

        <Panel className="p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              description="Grouped by the status CineCue currently sees in your selected area."
              eyebrow="Dashboard"
              title="Followed movies by local status"
            />
            <MetaPill>
              {dashboard?.totalFollows ?? 0} tracked title
              {(dashboard?.totalFollows ?? 0) === 1 ? "" : "s"}
            </MetaPill>
          </div>

          {!dashboard?.totalFollows ? (
            <div className="mt-6">
              <EmptyState
                title="No followed movies in this location yet"
                action={
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--oxblood)]">
                    Search above to start the radar <ArrowRightIcon />
                  </span>
                }
              >
                Search for a title, follow it, and this dashboard will start grouping the movie by its local theatrical status.
              </EmptyState>
            </div>
          ) : visibleSections.length ? (
            <div className="mt-6 space-y-8">
              {visibleSections.map((section) => (
                <div key={section.status} className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusBadge status={section.status} />
                      <h3 className="font-display text-2xl tracking-[-0.03em] text-[color:var(--foreground)]">
                        {section.label}
                      </h3>
                    </div>
                    <p className="text-sm text-[color:var(--foreground-muted)]">
                      {section.items.length} title{section.items.length === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="grid gap-4">
                    {section.items.map((movie) => (
                      <FollowedMovieCard
                        key={movie.movieId}
                        busy={busyMovieIds.includes(movie.movieId)}
                        locationId={selectedLocationId}
                        movie={movie}
                        onUnfollow={async (movieId) => handleToggleFollow(movieId, true)}
                        status={section.status}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState title="Nothing has local availability yet">
                That is a valid state. Keep following upcoming releases and use notifications to hear about the first schedule change.
              </EmptyState>
            </div>
          )}
        </Panel>

        {error ? <Notice tone="danger">{error}</Notice> : null}
      </div>

      <aside className="space-y-6">
        <Panel className="p-6 sm:p-7" tone="soft">
          <SectionHeading
            description="The most recent local shifts across the titles you already follow."
            eyebrow="Recent activity"
            title="Availability changes"
          />

          <div className="mt-6 space-y-3">
            {changes.length ? (
              changes.map((change) => (
                <ChangeItem
                  key={change.id}
                  change={change}
                  locationId={selectedLocationId}
                />
              ))
            ) : (
              <Notice tone="neutral">
                No recent followed-title changes yet. When a local status changes, the feed will light up here.
              </Notice>
            )}
          </div>
        </Panel>

        <Panel className="p-6 sm:p-7" tone="contrast">
          <Eyebrow className="text-white/55">Helpful paths</Eyebrow>
          <div className="mt-5 space-y-3">
            <ActionLink href="/settings/locations" size="lg" variant="secondary">
              Location settings
            </ActionLink>
            <ActionLink href="/settings/notifications" size="lg" variant="secondary">
              Notification settings
            </ActionLink>
            <ActionLink href="/api/ready" size="lg" variant="ghost">
              Readiness endpoint
            </ActionLink>
            <ActionLink href="/api/health" size="lg" variant="ghost">
              Health endpoint
            </ActionLink>
          </div>
        </Panel>
      </aside>
    </div>
  );
}
