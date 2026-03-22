"use client";

import { useEffect, useState } from "react";
import { readJson } from "@/lib/phase3/client";

type PreferencesResponse = {
  email: string | null;
  smtpConfigured: boolean;
  preferences: {
    emailEnabled: boolean;
    newlyScheduledEnabled: boolean;
    nowPlayingEnabled: boolean;
    advanceTicketsEnabled: boolean;
  };
};

export function NotificationSettingsClient() {
  const [data, setData] = useState<PreferencesResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
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
    })();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!data) {
      return;
    }

    try {
      setSaving(true);
      setSavedMessage(null);
      setError(null);

      const response = await readJson<PreferencesResponse>(
        "/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify(data.preferences),
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
          Email-first alerts
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Notification settings
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          Phase 3 uses email as the first alert channel. Push, SSE, and PWA-level live
          refresh come later once the sync and change-detection paths are hardened.
        </p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p>
            <strong>Destination email:</strong> {data.email ?? "No email available on this account"}
          </p>
          <p className="mt-1">
            <strong>SMTP configured:</strong> {data.smtpConfigured ? "Yes" : "No"}
          </p>
        </div>
      </section>

      <form
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="space-y-5">
          <label className="flex items-start gap-3">
            <input
              checked={data.preferences.emailEnabled}
              className="mt-1 h-4 w-4 rounded border-slate-300"
              disabled={!data.smtpConfigured}
              onChange={(event) =>
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
                )
              }
              type="checkbox"
            />
            <span>
              <span className="block font-semibold text-slate-900">Enable email alerts</span>
              <span className="block text-sm text-slate-600">
                Master switch for all Phase 3 email notifications.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              checked={data.preferences.newlyScheduledEnabled}
              className="mt-1 h-4 w-4 rounded border-slate-300"
              disabled={!data.preferences.emailEnabled || !data.smtpConfigured}
              onChange={(event) =>
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
                )
              }
              type="checkbox"
            />
            <span>
              <span className="block font-semibold text-slate-900">
                Newly scheduled near you
              </span>
              <span className="block text-sm text-slate-600">
                Send an alert when a followed movie gets its first local showtimes.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              checked={data.preferences.nowPlayingEnabled}
              className="mt-1 h-4 w-4 rounded border-slate-300"
              disabled={!data.preferences.emailEnabled || !data.smtpConfigured}
              onChange={(event) =>
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
                )
              }
              type="checkbox"
            />
            <span>
              <span className="block font-semibold text-slate-900">Now playing near you</span>
              <span className="block text-sm text-slate-600">
                Send an alert when a followed movie transitions into now playing.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              checked={data.preferences.advanceTicketsEnabled}
              className="mt-1 h-4 w-4 rounded border-slate-300"
              disabled={!data.preferences.emailEnabled || !data.smtpConfigured}
              onChange={(event) =>
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
                )
              }
              type="checkbox"
            />
            <span>
              <span className="block font-semibold text-slate-900">
                Advance tickets available
              </span>
              <span className="block text-sm text-slate-600">
                Send an alert when future local showtimes appear with advance tickets.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            className="h-11 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving || !data.smtpConfigured}
            type="submit"
          >
            {saving ? "Saving..." : "Save settings"}
          </button>

          {savedMessage ? <p className="text-sm text-emerald-700">{savedMessage}</p> : null}
        </div>

        {!data.smtpConfigured ? (
          <p className="mt-4 text-sm text-amber-700">
            SMTP is not configured yet, so settings can be reviewed but alerts cannot be
            delivered until the SMTP env vars are added.
          </p>
        ) : null}

        {!data.email ? (
          <p className="mt-4 text-sm text-amber-700">
            Your authenticated account does not currently expose an email address. CineCue
            cannot deliver email alerts until the user record has a valid email.
          </p>
        ) : null}

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      </form>
    </div>
  );
}
