"use client";

import { useEffect } from "react";
import { ensureServiceWorkerRegistration } from "@/modules/notifications/browser";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __cinecueInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function PwaProvider() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();

      const installEvent = event as BeforeInstallPromptEvent;
      window.__cinecueInstallPrompt = installEvent;

      window.dispatchEvent(
        new CustomEvent("cinecue:beforeinstallprompt", {
          detail: installEvent,
        }),
      );
    };

    const onInstalled = () => {
      window.__cinecueInstallPrompt = null;
      window.dispatchEvent(new CustomEvent("cinecue:appinstalled"));
    };

    if (window.isSecureContext && "serviceWorker" in navigator) {
      void ensureServiceWorkerRegistration().catch(() => undefined);
    }

    window.addEventListener(
      "beforeinstallprompt",
      onBeforeInstallPrompt as EventListener,
    );
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        onBeforeInstallPrompt as EventListener,
      );
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return null;
}
