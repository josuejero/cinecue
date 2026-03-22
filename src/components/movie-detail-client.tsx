"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarExportButton } from "@/components/calendar-export-button";
import { FavoriteTheatreButton } from "@/components/favorite-theatre-button";
import { readJson } from "@/lib/phase3/client";
import { formatDate, formatDateTime, humanizeStatus } from "@/lib/phase3/format";

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

  const loadDetail = useCallback(async (locationId: string) => {
    const data = await readJson<MovieDetailResponse>(
      `/api/movies/${movieId}?locationId=${encodeURIComponent(locationId)}`,
    );
    setDetail(data);
  }, [movieId]);

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
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-slate-500">Loading movie detail...</p>
      </div>
    );
  }

  if (!locations.length) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Save a ZIP code first</h2>
        <p className="mt-3 text-sm text-slate-600">
          Movie detail pages depend on a saved location so CineCue can resolve nearby
          theatres and showtimes.
        </p>
        <Link className="mt-4 inline-block font-semibold text-slate-900 underline" href="/dashboard">
          Go to dashboard setup
        </Link>
      </div>
    );
  }

  if (!detail) {
    return <p className="text-sm text-rose-600">{error ?? "Movie detail unavailable."}</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="h-72 w-48 shrink-0 overflow-hidden rounded-3xl bg-slate-100">
            {detail.movie.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={detail.movie.title}
                className="h-full w-full object-cover"
                src={detail.movie.posterUrl}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No poster
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Movie detail
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  {detail.movie.title}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  {detail.movie.releaseYear ? `${detail.movie.releaseYear} · ` : ""}
                  {detail.movie.releaseDate
                    ? `Released ${formatDate(detail.movie.releaseDate)}`
                    : "Release date TBD"}
                  {detail.movie.runtimeMinutes ? ` · ${detail.movie.runtimeMinutes} min` : ""}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select
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

                <button
                  className={`h-11 rounded-2xl px-4 text-sm font-semibold transition ${
                    detail.movie.isFollowed
                      ? "border border-slate-300 text-slate-900 hover:border-slate-900"
                      : "bg-slate-900 text-white hover:bg-slate-700"
                  }`}
                  disabled={busy}
                  onClick={() => void handleToggleFollow()}
                  type="button"
                >
                  {busy ? "Working..." : detail.movie.isFollowed ? "Unfollow" : "Follow"}
                </button>

                {detail.calendarExportUrl ? (
                  <CalendarExportButton href={detail.calendarExportUrl} />
                ) : null}
              </div>
            </div>

            {detail.movie.localStatus ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(detail.movie.localStatus.status)}`}
                >
                  {humanizeStatus(detail.movie.localStatus.status)}
                </span>
                <span className="text-sm text-slate-600">
                  Next showing: {formatDateTime(detail.movie.localStatus.nextShowingAt)}
                </span>
                <span className="text-sm text-slate-600">
                  Theatres: {detail.movie.localStatus.theatreCount}
                </span>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">
                No local status row exists yet for this movie in the selected area.
              </p>
            )}

            {detail.movie.longDescription || detail.movie.shortDescription ? (
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-700">
                {detail.movie.longDescription ?? detail.movie.shortDescription}
              </p>
            ) : null}

            {currentLocation ? (
              <p className="mt-4 text-sm text-slate-500">
                Viewing showtimes for {currentLocation.label}.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Next showings</h2>
        <div className="mt-4 space-y-3">
          {detail.movie.nextShowings.length ? (
            detail.movie.nextShowings.map((showing) => (
              <div
                key={showing.showtimeId}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{showing.theatre.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatDateTime(showing.startAtLocal)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {[showing.theatre.address1, showing.theatre.city, showing.theatre.state]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    {showing.qualities ? (
                      <p className="mt-1 text-sm text-slate-500">
                        Format: {showing.qualities}
                      </p>
                    ) : null}
                  </div>

                  {showing.ticketUrl ? (
                    <a
                      className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
                      href={showing.ticketUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Tickets
                    </a>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              No upcoming showtimes are currently stored for this movie in the selected area.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Nearby theatres listing this movie
        </h2>
        <div className="mt-4 space-y-3">
          {detail.movie.nearbyTheatres.length ? (
            detail.movie.nearbyTheatres.map((theatre) => (
              <div key={theatre.theatreId} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{theatre.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {[theatre.address1, theatre.city, theatre.state, theatre.postalCode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Next showing: {formatDateTime(theatre.nextShowingAt)} ·{" "}
                      {theatre.upcomingShowtimeCount} upcoming showtime
                      {theatre.upcomingShowtimeCount === 1 ? "" : "s"}
                    </p>
                  </div>

                  <FavoriteTheatreButton
                    initialFavorite={detail.favoriteTheatreIds.includes(theatre.theatreId)}
                    locationId={detail.location.locationId}
                    theatreId={theatre.theatreId}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              No nearby theatres are currently attached to this title in the selected area.
            </p>
          )}
        </div>
      </section>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
