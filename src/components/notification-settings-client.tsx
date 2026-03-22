"use client";

import { useEffect, useState } from "react";
import { InstallAppButton } from "@/components/install-app-button";
import { readJson } from "@/lib/phase3/client";
import {
  ensureServiceWorkerRegistration,
  serializePushSubscription,
  urlBase64ToUint8Array,
} from "@/lib/phase5/browser";

type PreferencesPayload = {
  id: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  newlyScheduledEnabled: boolean;
  nowPlayingEnabled: boolean;
  advanceTicketsEnabled: boolean;
  theatreCountIncreasedEnabled: boolean;
  finalShowingSoonEnabled: boolean;
  pushSubscriptionCount: number;
};

type PreferencesResponse = {
  email: string | null;
  smtpConfigured: boolean;
  pushConfigured: boolean;
  preferences: PreferencesPayload;
};

export function NotificationSettingsClient() {
  const [data, setData] = useState<PreferencesResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const response = await readJson<PreferencesResponse>(
        "/api/notifications/preferences",
      );
      setData(response);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to load notification preferences.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPushSupported(
      typeof window !== "undefined" &&
        window.isSecureContext &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window,
    );

    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }

    void load();
  }, []);

  async function savePreferences() {
    if (!data) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSavedMessage(null);

      const response = await readJson<PreferencesResponse>(
        "/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            emailEnabled: data.preferences.emailEnabled,
            pushEnabled: data.preferences.pushEnabled,
            newlyScheduledEnabled: data.preferences.newlyScheduledEnabled,
            nowPlayingEnabled: data.preferences.nowPlayingEnabled,
            advanceTicketsEnabled: data.preferences.advanceTicketsEnabled,
            theatreCountIncreasedEnabled:
              data.preferences.theatreCountIncreasedEnabled,
            finalShowingSoonEnabled: data.preferences.finalShowingSoonEnabled,
          }),
        },
      );

      setData(response);
      setSavedMessage("Notification settings saved.");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to save notification preferences.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function enablePush() {
    if (!pushSupported) {
      setError("Browser push is not supported in this browser.");
      return;
    }

    if (!data?.pushConfigured) {
      setError("Server-side web push is not configured yet.");
      return;
    }

    try {
      setPushBusy(true);
      setError(null);
      setSavedMessage(null);

      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== "granted") {
        throw new Error("Notification permission was not granted.");
      }

      const registration = await ensureServiceWorkerRegistration();
      const keyResponse = await readJson<{ publicKey: string }>(
        "/api/notifications/push/public-key",
      );

      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyResponse.publicKey),
        }));

      await readJson("/api/notifications/push", {
        method: "POST",
        body: JSON.stringify(serializePushSubscription(subscription)),
      });

      const response = await readJson<PreferencesResponse>(
        "/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            pushEnabled: true,
          }),
        },
      );

      setData(response);
      setSavedMessage("Browser push enabled.");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to enable browser push.",
      );
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    try {
      setPushBusy(true);
      setError(null);
      setSavedMessage(null);

      if (pushSupported) {
        const registration = await ensureServiceWorkerRegistration();
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          const payload = serializePushSubscription(subscription);

          await readJson("/api/notifications/push", {
            method: "DELETE",
            body: JSON.stringify({
              endpoint: payload.endpoint,
            }),
          });

          await subscription.unsubscribe().catch(() => undefined);
        }
      }

      const response = await readJson<PreferencesResponse>(
        "/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            pushEnabled: false,
          }),
        },
      );

      setData(response);
      setSavedMessage("Browser push disabled.");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to disable browser push.",
      );
    } finally {
      setPushBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-slate-500">Loading notification settings...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-rose-600">
          {error ?? "Notification settings are unavailable."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Alerts and delivery
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Notification settings
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          Phase 5 adds browser push, live dashboard refresh, and install support on top
          of the existing email alert flow.
        </p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p>
            <strong>Destination email:</strong>{" "}
            {data.email ?? "No email available on this account"}
          </p>
          <p className="mt-1">
            <strong>SMTP configured:</strong> {data.smtpConfigured ? "Yes" : "No"}
          </p>
          <p className="mt-1">
            <strong>Push configured:</strong> {data.pushConfigured ? "Yes" : "No"}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Email alerts</h2>
        <p className="mt-2 text-sm text-slate-600">
          Keep email as a fallback channel when push is unavailable or not enabled on
          this browser.
        </p>

        <label className="mt-5 flex items-start gap-3">
          <input
            checked={data.preferences.emailEnabled}
            className="mt-1 h-4 w-4 rounded border-slate-300"
            disabled={!data.smtpConfigured}
            onChange={(event) => {
              setSavedMessage(null);
              setData((current) =>
                current
                  ? {
                      ...current,
                      preferences: {
                        ...current.preferences,
                        emailEnabled: event.target.checked,
                      },
                    }
                  : current,
              );
            }}
            type="checkbox"
          />
          <span>
            <span className="block font-semibold text-slate-900">Enable email alerts</span>
            <span className="block text-sm text-slate-600">
              Master switch for all email notifications.
            </span>
          </span>
        </label>

        {!data.smtpConfigured ? (
          <p className="mt-4 text-sm text-amber-700">
            SMTP is not configured yet, so settings can be reviewed but email alerts
            cannot be delivered.
          </p>
        ) : null}

        {!data.email ? (
          <p className="mt-4 text-sm text-amber-700">
            Your authenticated account does not currently expose an email address. CineCue
            cannot deliver email alerts until the user record has a valid email.
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Browser push</h2>
        <p className="mt-2 text-sm text-slate-600">
          Push permission is only requested after you choose to enable it here.
        </p>

        <div className="mt-5 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <p>
            <strong>Browser support:</strong> {pushSupported ? "Available" : "Unavailable"}
          </p>
          <p>
            <strong>Server support:</strong> {data.pushConfigured ? "Configured" : "Not configured"}
          </p>
          <p>
            <strong>Permission:</strong> {permission}
          </p>
          <p>
            <strong>Active subscriptions:</strong> {data.preferences.pushSubscriptionCount}
          </p>
        </div>

        {permission === "denied" ? (
          <p className="mt-4 text-sm text-amber-700">
            Notifications are currently denied by the browser. Re-enable them in the
            browser site settings, then try again.
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          {data.preferences.pushEnabled && data.preferences.pushSubscriptionCount > 0 ? (
            <button
              className="h-11 rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-900 transition hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pushBusy}
              onClick={() => {
                void disablePush();
              }}
              type="button"
            >
              {pushBusy ? "Disabling..." : "Disable browser push"}
            </button>
          ) : (
            <button
              className="h-11 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!pushSupported || !data.pushConfigured || pushBusy}
              onClick={() => {
                void enablePush();
              }}
              type="button"
            >
              {pushBusy ? "Enabling..." : "Enable browser push"}
            </button>
          )}

          <InstallAppButton className="h-11 rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-900 transition hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60" />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Alert types</h2>
        <p className="mt-2 text-sm text-slate-600">
          These alert-type toggles apply to both email and push delivery.
        </p>

        <div className="mt-5 space-y-5">
          <label className="flex items-start gap-3">
            <input
              checked={data.preferences.newlyScheduledEnabled}
              className="mt-1 h-4 w-4 rounded border-slate-300"
              onChange={(event) => {
                setSavedMessage(null);
                setData((current) =>
                  current
                    ? {
                        ...current,
                        preferences: {
                          ...current.preferences,
                          newlyScheduledEnabled: event.target.checked,
                        },
                      }
                    : current,
                );
              }}
              type="checkbox"
            />
            <span>
              <span className="block font-semibold text-slate-900">Newly scheduled near you</span>
              <span className="block text-sm text-slate-600">
                Alert when a followed movie gets its first local showtimes.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              checked={data.preferences.nowPlayingEnabled}
              className="mt-1 h-4 w-4 rounded border-slate-300"
              onChange={(event) => {
                setSavedMessage(null);
                setData((current) =>
                  current
                    ? {
                        ...current,
                        preferences: {
                          ...current.preferences,
                          nowPlayingEnabled: event.target.checked,
                        },
                      }
                    : current,
                );
              }}
              type="checkbox"
            />
            <span>
              <span className="block font-semibold text-slate-900">Now playing near you</span>
              <span className="block text-sm text-slate-600">
                Alert when a followed movie transitions into now playing.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              checked={data.preferences.advanceTicketsEnabled}
              className="mt-1 h-4 w-4 rounded border-slate-300"
              onChange={(event) => {
                setSavedMessage(null);
                setData((current) =>
                  current
                    ? {
                        ...current,
                        preferences: {
                          ...current.preferences,
                          advanceTicketsEnabled: event.target.checked,
                        },
                      }
                    : current,
                );
              }}
              type="checkbox"
            />
            <span>
              <span className="block font-semibold text-slate-900">
                Advance tickets available
              </span>
              <span className="block text-sm text-slate-600">
                Alert when future local showtimes appear with advance tickets.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              checked={data.preferences.theatreCountIncreasedEnabled}
              className="mt-1 h-4 w-4 rounded border-slate-300"
              onChange={(event) => {
                setSavedMessage(null);
                setData((current) =>
                  current
                    ? {
                        ...current,
                        preferences: {
                          ...current.preferences,
                          theatreCountIncreasedEnabled: event.target.checked,
                        },
                      }
                    : current,
                );
              }}
              type="checkbox"
            />
            <span>
              <span className="block font-semibold text-slate-900">
                Expanded to more nearby theatres
              </span>
              <span className="block text-sm text-slate-600">
                Alert when local coverage expands to additional theatres.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              checked={data.preferences.finalShowingSoonEnabled}
              className="mt-1 h-4 w-4 rounded border-slate-300"
              onChange={(event) => {
                setSavedMessage(null);
                setData((current) =>
                  current
                    ? {
                        ...current,
                        preferences: {
                          ...current.preferences,
                          finalShowingSoonEnabled: event.target.checked,
                        },
                      }
                    : current,
                );
              }}
              type="checkbox"
            />
            <span>
              <span className="block font-semibold text-slate-900">Final local showing soon</span>
              <span className="block text-sm text-slate-600">
                Alert when a followed movie looks close to leaving local theatres.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            className="h-11 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
            onClick={() => {
              void savePreferences();
            }}
            type="button"
          >
            {saving ? "Saving..." : "Save settings"}
          </button>

          {savedMessage ? <p className="text-sm text-emerald-700">{savedMessage}</p> : null}
        </div>

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      </section>
    </div>
  );
}
