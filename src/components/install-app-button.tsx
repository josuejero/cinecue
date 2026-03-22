"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __cinecueInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function InstallAppButton({
  className,
  children = "Install app",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setDeferredPrompt(window.__cinecueInstallPrompt ?? null);

    const onPrompt = (event: Event) => {
      const customEvent = event as CustomEvent<BeforeInstallPromptEvent>;
      setDeferredPrompt(customEvent.detail);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
    };

    window.addEventListener(
      "cinecue:beforeinstallprompt",
      onPrompt as EventListener,
    );
    window.addEventListener("cinecue:appinstalled", onInstalled as EventListener);

    return () => {
      window.removeEventListener(
        "cinecue:beforeinstallprompt",
        onPrompt as EventListener,
      );
      window.removeEventListener(
        "cinecue:appinstalled",
        onInstalled as EventListener,
      );
    };
  }, []);

  if (!deferredPrompt) {
    return null;
  }

  return (
    <button
      className={className}
      disabled={busy}
      onClick={() => {
        void (async () => {
          try {
            setBusy(true);
            await deferredPrompt.prompt();
            await deferredPrompt.userChoice.catch(() => null);
          } finally {
            setBusy(false);
            setDeferredPrompt(null);
          }
        })();
      }}
      type="button"
    >
      {busy ? "Installing..." : children}
    </button>
  );
}
