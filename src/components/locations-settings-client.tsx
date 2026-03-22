"use client";

import { useEffect, useMemo, useState } from "react";
import { readJson } from "@/lib/phase3/client";
import { formatDateTime } from "@/lib/phase3/format";

type SavedLocation = {
  userLocationId: string;
  locationId: string;
  normalizedKey: string;
  postalCode: string | null;
  radiusMiles: number;
  label: string;
  isDefault: boolean;
  displayOrder: number;
  distanceOverrideMiles: number | null;
  lastUsedAt: string | null;
  kind: "zip" | "coordinates";
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  followCount: number;
  favoriteTheatreCount: number;
};

type LocationsResponse = {
  location?: SavedLocation | null;
  locations: SavedLocation[];
};

export function LocationsSettingsClient() {
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [postalCode, setPostalCode] = useState("");
  const [label, setLabel] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadLocations() {
    setLoading(true);
    setError(null);

    try {
      const response = await readJson<LocationsResponse>("/api/locations");
      setLocations(response.locations);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load locations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLocations();
  }, []);

  const defaultLocation = useMemo(
    () => locations.find((location) => location.isDefault) ?? null,
    [locations],
  );

  async function handleCreateLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!postalCode.trim()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const response = await readJson<LocationsResponse>("/api/locations", {
        method: "POST",
        body: JSON.stringify({
          postalCode: postalCode.trim(),
          label: label.trim() || null,
          radiusMiles,
          makeDefault: locations.length === 0,
        }),
      });

      setPostalCode("");
      setLabel("");
      setRadiusMiles(25);
      setLocations(response.locations);
      setMessage("Location saved.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save location.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMakeDefault(locationId: string) {
    try {
      setError(null);
      setMessage(null);

      const response = await readJson<LocationsResponse>("/api/locations", {
        method: "PATCH",
        body: JSON.stringify({
          locationId,
          makeDefault: true,
        }),
      });

      setLocations(response.locations);
      setMessage("Default location updated.");
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to update default location.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Add a location</h2>
        <form className="mt-4 grid gap-4 sm:grid-cols-4" onSubmit={handleCreateLocation}>
          <label className="flex flex-col gap-2 sm:col-span-1">
            <span className="text-sm font-medium text-slate-700">ZIP</span>
            <input
              className="h-11 rounded-2xl border border-slate-300 px-4 outline-none ring-0"
              onChange={(event) => setPostalCode(event.target.value)}
              placeholder="10001"
              required
              value={postalCode}
            />
          </label>

          <label className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">Label</span>
            <input
              className="h-11 rounded-2xl border border-slate-300 px-4 outline-none ring-0"
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Home, Work, Campus..."
              value={label}
            />
          </label>

          <label className="flex flex-col gap-2 sm:col-span-1">
            <span className="text-sm font-medium text-slate-700">Radius</span>
            <select
              className="h-11 rounded-2xl border border-slate-300 px-4 outline-none ring-0"
              onChange={(event) => setRadiusMiles(Number(event.target.value))}
              value={radiusMiles}
            >
              {[5, 10, 15, 25, 35, 50].map((value) => (
                <option key={value} value={value}>
                  {value} miles
                </option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-4">
            <button
              className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
              disabled={saving}
              type="submit"
            >
              {saving ? "Saving..." : "Save location"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">Your saved locations</h2>
          {defaultLocation ? (
            <p className="text-sm text-slate-600">
              Default: <span className="font-medium text-slate-900">{defaultLocation.label}</span>
            </p>
          ) : null}
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-600">Loading locations...</p>
        ) : locations.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No saved locations yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {locations.map((location) => (
              <div key={location.userLocationId} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{location.label}</h3>
                      {location.isDefault ? (
                        <span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                          Default
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {location.kind === "zip"
                        ? `ZIP ${location.postalCode}`
                        : `${location.latitude}, ${location.longitude}`} · {location.distanceOverrideMiles ?? location.radiusMiles} mi · {location.followCount} follow{location.followCount === 1 ? "" : "s"} · {location.favoriteTheatreCount} favorite theatre{location.favoriteTheatreCount === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Last used: {formatDateTime(location.lastUsedAt)}
                    </p>
                  </div>

                  {!location.isDefault ? (
                    <button
                      className="inline-flex h-10 items-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-900 transition hover:border-slate-900"
                      onClick={() => void handleMakeDefault(location.locationId)}
                      type="button"
                    >
                      Make default
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      </section>
    </div>
  );
}
