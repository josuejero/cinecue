"use client";

import { useEffect, useState } from "react";
import { InstallAppButton } from "@/components/install-app-button";
import {
  ActionButton,
  BellIcon,
  CheckboxRow,
  MetaPill,
  Notice,
  Panel,
  SectionHeading,
} from "@/components/ui";
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
      <Panel className="p-8" tone="soft">
        <p className="text-sm text-[color:var(--foreground-muted)]">
          Loading notification settings...
        </p>
      </Panel>
    );
  }

  if (!data) {
    return (
      <Panel className="p-8">
        <Notice tone="danger">
          {error ?? "Notification settings are unavailable."}
        </Notice>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <Panel className="cine-enter p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <SectionHeading
            description="Choose how CineCue reaches you when a local movie status changes. Email remains the fallback channel; browser push adds a faster layer for this device."
            eyebrow="Alerts and delivery"
            title="Notification control room"
          />

          <Panel className="p-5 sm:p-6" tone="soft">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/75 text-[color:var(--oxblood)] shadow-[var(--shadow-soft)]">
                  <BellIcon />
                </span>
                <div>
                  <p className="font-semibold text-[color:var(--foreground)]">
                    Destination account
                  </p>
                  <p className="text-sm text-[color:var(--foreground-muted)]">
                    {data.email ?? "No email exposed on this account"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <MetaPill>SMTP {data.smtpConfigured ? "configured" : "missing"}</MetaPill>
                <MetaPill>Push server {data.pushConfigured ? "configured" : "missing"}</MetaPill>
                <MetaPill>{data.preferences.pushSubscriptionCount} active subscription{data.preferences.pushSubscriptionCount === 1 ? "" : "s"}</MetaPill>
                <MetaPill>Browser permission {permission}</MetaPill>
              </div>
            </div>
          </Panel>
        </div>
      </Panel>

      {savedMessage ? <Notice tone="success">{savedMessage}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Panel className="p-6 sm:p-8" tone="soft">
        <SectionHeading
          description="Keep email enabled as the dependable fallback when push is unavailable or not enabled on this browser."
          eyebrow="Email"
          title="Email alerts"
        />

        <div className="mt-6 space-y-4">
          <CheckboxRow
            checked={data.preferences.emailEnabled}
            description="Master switch for all email notifications sent by CineCue."
            disabled={!data.smtpConfigured}
            label="Enable email alerts"
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
          />

          {!data.smtpConfigured ? (
            <Notice tone="warning">
              SMTP is not configured yet, so settings can be reviewed but email alerts cannot be delivered.
            </Notice>
          ) : null}

          {!data.email ? (
            <Notice tone="warning">
              Your authenticated account does not currently expose an email address. CineCue cannot deliver email alerts until the user record has a valid email.
            </Notice>
          ) : null}
        </div>
      </Panel>

      <Panel className="p-6 sm:p-8">
        <SectionHeading
          description="Push permission is only requested after you choose to enable it here on this device."
          eyebrow="Browser push"
          title="Fastest route to a live change"
        />

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <MetaPill>Browser support {pushSupported ? "available" : "unavailable"}</MetaPill>
          <MetaPill>Server support {data.pushConfigured ? "configured" : "not configured"}</MetaPill>
          <MetaPill>Permission {permission}</MetaPill>
          <MetaPill>{data.preferences.pushSubscriptionCount} device subscription{data.preferences.pushSubscriptionCount === 1 ? "" : "s"}</MetaPill>
        </div>

        {permission === "denied" ? (
          <div className="mt-5">
            <Notice tone="warning">
              Notifications are currently denied by the browser. Re-enable them in site settings, then try again.
            </Notice>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {data.preferences.pushEnabled && data.preferences.pushSubscriptionCount > 0 ? (
            <ActionButton
              disabled={pushBusy}
              onClick={() => {
                void disablePush();
              }}
              size="lg"
              variant="secondary"
            >
              {pushBusy ? "Disabling..." : "Disable browser push"}
            </ActionButton>
          ) : (
            <ActionButton
              disabled={!pushSupported || !data.pushConfigured || pushBusy}
              onClick={() => {
                void enablePush();
              }}
              size="lg"
              variant="primary"
            >
              {pushBusy ? "Enabling..." : "Enable browser push"}
            </ActionButton>
          )}

          <InstallAppButton size="lg" variant="secondary">
            Install app
          </InstallAppButton>
        </div>
      </Panel>

      <Panel className="p-6 sm:p-8" tone="soft">
        <SectionHeading
          description="These event toggles apply to both email and push delivery."
          eyebrow="Alert types"
          title="What should trigger a notification?"
        />

        <div className="mt-6 space-y-4">
          <CheckboxRow
            checked={data.preferences.newlyScheduledEnabled}
            description="Alert when a followed movie gets its first local showtimes."
            label="Newly scheduled near you"
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
          />

          <CheckboxRow
            checked={data.preferences.nowPlayingEnabled}
            description="Alert when a followed movie transitions into now playing."
            label="Now playing near you"
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
          />

          <CheckboxRow
            checked={data.preferences.advanceTicketsEnabled}
            description="Alert when future local showtimes appear with advance tickets."
            label="Advance tickets available"
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
          />

          <CheckboxRow
            checked={data.preferences.theatreCountIncreasedEnabled}
            description="Alert when local coverage expands to additional theatres."
            label="Expanded to more nearby theatres"
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
          />

          <CheckboxRow
            checked={data.preferences.finalShowingSoonEnabled}
            description="Alert when a followed movie looks close to leaving local theatres."
            label="Final local showing soon"
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
          />
        </div>

        <div className="mt-6">
          <ActionButton
            disabled={saving}
            onClick={() => {
              void savePreferences();
            }}
            size="lg"
            variant="primary"
          >
            {saving ? "Saving..." : "Save settings"}
          </ActionButton>
        </div>
      </Panel>
    </div>
  );
}
