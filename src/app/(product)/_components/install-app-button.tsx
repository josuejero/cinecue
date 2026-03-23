"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ActionButton, DownloadIcon } from "@/shared/ui/ui";

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
  icon = <DownloadIcon />,
  size = "md",
  variant = "secondary",
}: {
  className?: string;
  children?: ReactNode;
  icon?: ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost" | "danger";
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
    <ActionButton
      className={className}
      disabled={busy}
      icon={icon}
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
      size={size}
      variant={variant}
    >
      {busy ? "Installing..." : children}
    </ActionButton>
  );
}
