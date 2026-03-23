"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActionButton,
  EmptyState,
  FieldLabel,
  MapPinIcon,
  MetaPill,
  Notice,
  Panel,
  SectionHeading,
  SelectInput,
  TextInput,
} from "@/shared/ui/ui";
import { readJson } from "@/shared/utils/http-client";
import { formatDateTime } from "@/modules/availability/domain/format";

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
      <Panel className="cine-enter p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-5">
            <SectionHeading
              description="Save multiple markets, assign a human label, and decide which area becomes the default lens for your dashboard and alerts."
              eyebrow="Add a location"
              title="Build your local map"
            />

            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreateLocation}>
              <div className="space-y-2">
                <FieldLabel htmlFor="location-zip">ZIP</FieldLabel>
                <TextInput
                  id="location-zip"
                  onChange={(event) => setPostalCode(event.target.value)}
                  placeholder="10001"
                  required
                  value={postalCode}
                />
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="location-label">Label</FieldLabel>
                <TextInput
                  id="location-label"
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Home, Work, Campus..."
                  value={label}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <FieldLabel htmlFor="location-radius">Radius</FieldLabel>
                <SelectInput
                  id="location-radius"
                  onChange={(event) => setRadiusMiles(Number(event.target.value))}
                  value={radiusMiles}
                >
                  {[5, 10, 15, 25, 35, 50].map((value) => (
                    <option key={value} value={value}>
                      {value} miles
                    </option>
                  ))}
                </SelectInput>
              </div>

              <div className="sm:col-span-2">
                <ActionButton
                  disabled={saving}
                  icon={<MapPinIcon />}
                  size="lg"
                  type="submit"
                  variant="primary"
                >
                  {saving ? "Saving..." : "Save location"}
                </ActionButton>
              </div>
            </form>
          </div>

          <Panel className="p-5 sm:p-6" tone="soft">
            <SectionHeading
              description="The default location powers your first dashboard view, local movie detail, and the market CineCue assumes for alerts."
              eyebrow="Current default"
              title={defaultLocation?.label ?? "No default yet"}
            />

            <div className="mt-5 space-y-3">
              {defaultLocation ? (
                <>
                  <MetaPill>
                    {defaultLocation.kind === "zip"
                      ? `ZIP ${defaultLocation.postalCode}`
                      : `${defaultLocation.latitude}, ${defaultLocation.longitude}`}
                  </MetaPill>
                  <MetaPill>
                    {defaultLocation.distanceOverrideMiles ?? defaultLocation.radiusMiles} mile
                    radius
                  </MetaPill>
                  <MetaPill>
                    {defaultLocation.followCount} follow
                    {defaultLocation.followCount === 1 ? "" : "s"}
                  </MetaPill>
                  <MetaPill>
                    {defaultLocation.favoriteTheatreCount} saved theatre
                    {defaultLocation.favoriteTheatreCount === 1 ? "" : "s"}
                  </MetaPill>
                  <MetaPill>Last used {formatDateTime(defaultLocation.lastUsedAt)}</MetaPill>
                </>
              ) : (
                <Notice tone="neutral">
                  Add your first location and CineCue will automatically promote it to default.
                </Notice>
              )}
            </div>
          </Panel>
        </div>
      </Panel>

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Panel className="p-6 sm:p-8" tone="soft">
        <SectionHeading
          description="Each saved area keeps its own follows, favourite theatres, and usage context."
          eyebrow="Saved areas"
          title="Your location library"
        />

        {loading ? (
          <div className="mt-6">
            <Notice tone="neutral">Loading locations...</Notice>
          </div>
        ) : locations.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="No saved locations yet">
              Add a ZIP above to create the first market CineCue should monitor for you.
            </EmptyState>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {locations.map((location) => (
              <Panel key={location.userLocationId} className="cine-hover-lift p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-display text-2xl tracking-[-0.03em] text-[color:var(--foreground)]">
                        {location.label}
                      </h3>
                      {location.isDefault ? <MetaPill>Default</MetaPill> : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <MetaPill>
                        {location.kind === "zip"
                          ? `ZIP ${location.postalCode}`
                          : `${location.latitude}, ${location.longitude}`}
                      </MetaPill>
                      <MetaPill>
                        {location.distanceOverrideMiles ?? location.radiusMiles} mile radius
                      </MetaPill>
                      <MetaPill>
                        {location.followCount} follow{location.followCount === 1 ? "" : "s"}
                      </MetaPill>
                      <MetaPill>
                        {location.favoriteTheatreCount} theatre
                        {location.favoriteTheatreCount === 1 ? "" : "s"}
                      </MetaPill>
                    </div>

                    <p className="text-sm leading-7 text-[color:var(--foreground-muted)]">
                      Last used {formatDateTime(location.lastUsedAt)}. Added on{" "}
                      {formatDateTime(location.createdAt)}.
                    </p>
                  </div>

                  {!location.isDefault ? (
                    <ActionButton
                      onClick={() => {
                        void handleMakeDefault(location.locationId);
                      }}
                      size="sm"
                      variant="secondary"
                    >
                      Make default
                    </ActionButton>
                  ) : null}
                </div>
              </Panel>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
