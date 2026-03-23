import type { Metadata } from "next";
import { PageShell } from "@/shared/ui/app-shell";
import { ActionLink, ArrowLeftIcon, Eyebrow, Notice, Panel } from "@/shared/ui/ui";

export const metadata: Metadata = {
  title: "Offline",
  description: "CineCue's offline fallback screen.",
};

export default function OfflinePage() {
  return (
    <PageShell width="narrow">
      <div className="flex min-h-[calc(100vh-3rem)] flex-col justify-center gap-6">
        <Panel className="cine-enter overflow-hidden p-8 sm:p-10">
          <div className="space-y-4">
            <Eyebrow>CineCue</Eyebrow>
            <h1 className="font-display text-4xl tracking-[-0.05em] text-[color:var(--foreground)] sm:text-5xl">
              You are offline
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[color:var(--foreground-muted)] sm:text-base">
              Previously loaded screens may still open, but live availability updates, push
              enrollment, and provider-backed data need a connection.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <ActionLink href="/" icon={<ArrowLeftIcon />} size="lg" variant="primary">
              Return home
            </ActionLink>
          </div>
        </Panel>

        <Notice tone="neutral">
          If this device has already loaded a CineCue screen, the app may still show cached pages while the network is unavailable.
        </Notice>
      </div>
    </PageShell>
  );
}
