"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { InstallAppButton } from "@/components/install-app-button";
import { readJson } from "@/lib/phase3/client";
import {
  describeAvailabilityChange,
  formatDate,
  formatDateTime,
  humanizeStatus,
} from "@/lib/phase3/format";

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

function statusTone(status: string) {
  switch (status) {
    case "now_playing":
      return "bg-emerald-100 text-emerald-800";
    case "advance_tickets":
      return "bg-blue-100 text-blue-800";
    case "coming_soon":
      return "bg-violet-100 text-violet-800";
    case "stopped_playing":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-amber-100 text-amber-800";
  }
}

function liveTone(state: "idle" | "connecting" | "connected" | "reconnecting") {
  switch (state) {
    case "connected":
      return "bg-emerald-100 text-emerald-800";
    case "reconnecting":
      return "bg-amber-100 text-amber-800";
    case "connecting":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-slate-200 text-slate-700";
  }
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(status)}`}
    >
      {humanizeStatus(status)}
    </span>
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

  const loadDashboardBundle = useCallback(async (
    locationId: string,
    options?: { refreshDashboard?: boolean },
  ) => {
    const dashboardQuery = new URLSearchParams({ locationId });

    if (options?.refreshDashboard) {
      dashboardQuery.set("refresh", "true");
    }

    const [dashboardData, changeData] = await Promise.all([
      readJson<DashboardResponse>(
        `/api/dashboard?${dashboardQuery.toString()}`,
      ),
      readJson<ChangesResponse>(
        `/api/availability/changes?locationId=${encodeURIComponent(locationId)}&limit=12`,
      ),
    ]);

    setDashboard(dashboardData);
    setChanges(changeData.changes);
  }, []);

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
    async (
      locationId: string,
      query?: string,
      options?: { refreshDashboard?: boolean },
    ) => {
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
          zip: zip.trim(),
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
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-slate-500">Loading your dashboard...</p>
      </div>
    );
  }

  if (!locations.length) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Get started
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Save a ZIP code to turn on local movie tracking
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            CineCue is built around followed movies and local availability changes. Your
            first saved ZIP becomes the default area for dashboard reads, movie detail
            pages, live updates, and notifications.
          </p>

          <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={handleSaveZip}>
            <label className="sr-only" htmlFor="zip">
              ZIP code
            </label>
            <input
              id="zip"
              className="h-12 flex-1 rounded-2xl border border-slate-300 px-4 text-sm outline-none transition focus:border-slate-900"
              value={zip}
              onChange={(event) => setZip(event.target.value)}
              placeholder="Enter ZIP code"
            />
            <button
              className="h-12 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={savingZip}
              type="submit"
            >
              {savingZip ? "Saving..." : "Save ZIP"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-8">
          <h3 className="text-lg font-semibold text-slate-900">What Phase 5 adds</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>- Live in-session dashboard refresh</li>
            <li>- Browser push enrollment</li>
            <li>- Installable app metadata and icons</li>
            <li>- Offline fallback page</li>
            <li>- Per-alert controls across email and push</li>
          </ul>
        </section>

        {error ? <p className="text-sm text-rose-600 lg:col-span-2">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Your area
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                {currentLocation?.label}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {currentLocation?.postalCode
                  ? `ZIP ${currentLocation.postalCode}`
                  : currentLocation?.normalizedKey}{" "}
                · {currentLocation?.radiusMiles} mi radius
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span
                  className={`inline-flex rounded-full px-3 py-1 font-medium ${liveTone(liveState)}`}
                >
                  {liveState === "connected"
                    ? "Live updates on"
                    : liveState === "reconnecting"
                      ? "Reconnecting live updates"
                      : liveState === "connecting"
                        ? "Connecting live updates"
                        : "Live updates idle"}
                </span>
                {lastLiveUpdate ? (
                  <span className="text-slate-500">
                    Last refresh: {formatDateTime(lastLiveUpdate)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="text-sm text-slate-600" htmlFor="location-picker">
                Saved locations
              </label>
              <select
                id="location-picker"
                className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-slate-900"
                onChange={(event) => setSelectedLocationId(event.target.value)}
                value={selectedLocationId}
              >
                {locations.map((location) => (
                  <option key={location.locationId} value={location.locationId}>
                    {location.label}
                  </option>
                ))}
              </select>
              <InstallAppButton className="h-11 rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-900 transition hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60" />
            </div>
          </div>

          <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={handleSaveZip}>
            <input
              className="h-11 flex-1 rounded-2xl border border-slate-300 px-4 text-sm outline-none focus:border-slate-900"
              onChange={(event) => setZip(event.target.value)}
              placeholder="Add another ZIP code"
              value={zip}
            />
            <button
              className="h-11 rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-900 transition hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={savingZip}
              type="submit"
            >
              {savingZip ? "Saving..." : "Add ZIP"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Search and follow
            </p>
            <h3 className="text-xl font-semibold text-slate-900">Find titles to track</h3>
          </div>

          <input
            className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none transition focus:border-slate-900"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by movie title"
            value={searchQuery}
          />

          {searchQuery.trim().length >= 2 ? (
            <div className="mt-4 space-y-3">
              {searchLoading ? (
                <p className="text-sm text-slate-500">Searching...</p>
              ) : searchResults.length ? (
                searchResults.map((movie) => {
                  const busy = busyMovieIds.includes(movie.movieId);

                  return (
                    <div
                      key={movie.movieId}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <Link
                          className="font-semibold text-slate-900 hover:underline"
                          href={`/movies/${movie.movieId}?locationId=${encodeURIComponent(selectedLocationId)}`}
                        >
                          {movie.title}
                        </Link>
                        <p className="mt-1 text-sm text-slate-500">
                          {movie.releaseYear ? `${movie.releaseYear} · ` : ""}
                          {movie.releaseDate
                            ? formatDate(movie.releaseDate)
                            : "Release date TBD"}
                        </p>
                        {movie.shortDescription ? (
                          <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                            {movie.shortDescription}
                          </p>
                        ) : null}
                      </div>

                      <button
                        className={`h-10 rounded-2xl px-4 text-sm font-semibold transition ${
                          movie.isFollowed
                            ? "border border-slate-300 text-slate-900 hover:border-slate-900"
                            : "bg-slate-900 text-white hover:bg-slate-700"
                        }`}
                        disabled={busy}
                        onClick={() => void handleToggleFollow(movie.movieId, movie.isFollowed)}
                        type="button"
                      >
                        {busy ? "Working..." : movie.isFollowed ? "Unfollow" : "Follow"}
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">No matches yet.</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Start typing at least 2 characters to search.
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Dashboard
              </p>
              <h3 className="text-xl font-semibold text-slate-900">
                Followed movies by local status
              </h3>
            </div>
            <p className="text-sm text-slate-500">
              {dashboard?.totalFollows ?? 0} followed title
              {(dashboard?.totalFollows ?? 0) === 1 ? "" : "s"}
            </p>
          </div>

          {!dashboard?.totalFollows ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
              You do not have any followed movies in this location yet. Search for a title
              above and follow it to populate the dashboard.
            </div>
          ) : visibleSections.length ? (
            <div className="mt-5 space-y-6">
              {visibleSections.map((section) => (
                <div key={section.status}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusPill status={section.status} />
                      <h4 className="font-semibold text-slate-900">{section.label}</h4>
                    </div>
                    <p className="text-sm text-slate-500">
                      {section.items.length} title{section.items.length === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="grid gap-3">
                    {section.items.map((movie) => {
                      const busy = busyMovieIds.includes(movie.movieId);

                      return (
                        <div
                          key={movie.movieId}
                          className="rounded-2xl border border-slate-200 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <Link
                                className="font-semibold text-slate-900 hover:underline"
                                href={`/movies/${movie.movieId}?locationId=${encodeURIComponent(selectedLocationId)}`}
                              >
                                {movie.title}
                              </Link>
                              <p className="mt-1 text-sm text-slate-500">
                                {movie.releaseYear ? `${movie.releaseYear} · ` : ""}
                                {movie.releaseDate
                                  ? `Released ${formatDate(movie.releaseDate)}`
                                  : "Release date TBD"}
                              </p>
                              {movie.shortDescription ? (
                                <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                                  {movie.shortDescription}
                                </p>
                              ) : null}
                            </div>

                            <button
                              className="h-10 rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-900 transition hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={busy}
                              onClick={() => void handleToggleFollow(movie.movieId, true)}
                              type="button"
                            >
                              {busy ? "Working..." : "Unfollow"}
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                            <span>
                              <strong>Next:</strong> {formatDateTime(movie.nextShowingAt)}
                            </span>
                            <span>
                              <strong>Theatres:</strong> {movie.theatreCount}
                            </span>
                            <span>
                              <strong>Status updated:</strong>{" "}
                              {formatDateTime(movie.statusChangedAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
              No followed titles have local availability in this view yet. That is a valid
              state. Keep following upcoming movies and use the notifications page to turn
              on alerts for the first local schedule change.
            </div>
          )}
        </section>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>

      <aside className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recent changes
          </p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            Availability changes for followed titles
          </h3>

          <div className="mt-4 space-y-3">
            {changes.length ? (
              changes.map((change) => (
                <Link
                  key={change.id}
                  className="block rounded-2xl border border-slate-200 p-4 transition hover:border-slate-900"
                  href={`/movies/${change.movieId}?locationId=${encodeURIComponent(selectedLocationId)}`}
                >
                  <p className="font-semibold text-slate-900">{change.title}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {describeAvailabilityChange(change.previousStatus, change.newStatus)}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {formatDateTime(change.changedAt)}
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-500">No recent followed-title changes yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Helpful paths
          </p>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            <Link
              className="font-semibold text-slate-900 hover:underline"
              href="/settings/locations"
            >
              Location settings
            </Link>
            <Link
              className="font-semibold text-slate-900 hover:underline"
              href="/settings/notifications"
            >
              Notification settings
            </Link>
            <a className="font-semibold text-slate-900 hover:underline" href="/api/ready">
              Readiness endpoint
            </a>
            <a className="font-semibold text-slate-900 hover:underline" href="/api/health">
              Health endpoint
            </a>
          </div>
        </section>
      </aside>
    </div>
  );
}
