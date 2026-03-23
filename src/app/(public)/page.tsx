import type { Metadata } from "next";
import { auth } from "@/auth";
import { SignInButton } from "@/shared/ui/auth-buttons";
import { PageShell } from "@/shared/ui/app-shell";
import {
  ArrowRightIcon,
  BellIcon,
  Eyebrow,
  MapPinIcon,
  MetaPill,
  Notice,
  Panel,
  PulseIcon,
} from "@/shared/ui/ui";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Track Local Movie Availability",
  description: "Follow movies, monitor nearby theatres, and catch the local status changes that matter.",
};

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  const githubConfigured =
    Boolean(process.env.AUTH_GITHUB_ID) && Boolean(process.env.AUTH_GITHUB_SECRET);

  return (
    <PageShell width="landing">
      <div className="flex min-h-[calc(100vh-3rem)] flex-col justify-center gap-8 py-6 lg:gap-10">
        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-stretch">
          <Panel className="cine-enter overflow-hidden p-8 sm:p-10 lg:p-12">
            <div className="relative space-y-8">
              <div className="flex flex-wrap items-center gap-2.5">
                <Eyebrow>CineCue</Eyebrow>
                <MetaPill>
                  <PulseIcon />
                  Local theatrical radar
                </MetaPill>
              </div>

              <div className="space-y-6">
                <h1 className="max-w-5xl font-display text-5xl leading-none tracking-[-0.06em] text-[color:var(--foreground)] sm:text-6xl lg:text-[5.4rem]">
                  Follow movies.
                  <br />
                  Watch your market move.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-[color:var(--foreground-muted)] sm:text-lg">
                  CineCue is not trying to be a giant database. It is a focused local availability
                  dashboard built around the movies you follow, the theatres near you, and the
                  schedule changes that actually matter.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {githubConfigured ? (
                  <SignInButton icon={<ArrowRightIcon />}>Continue with GitHub</SignInButton>
                ) : (
                  <Notice tone="warning">
                    GitHub auth is not configured yet. Set `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`
                    to turn on sign-in.
                  </Notice>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <MetaPill>
                  <MapPinIcon />
                  Save ZIP-based markets
                </MetaPill>
                <MetaPill>
                  <PulseIcon />
                  Track live status changes
                </MetaPill>
                <MetaPill>
                  <BellIcon />
                  Tune alerts by event type
                </MetaPill>
              </div>
            </div>
          </Panel>

          <Panel className="cine-enter-delay overflow-hidden p-6 sm:p-7 lg:p-8" tone="contrast">
            <div className="space-y-6">
              <div className="space-y-3">
                <Eyebrow className="text-white/55">Preview</Eyebrow>
                <h2 className="font-display text-4xl tracking-[-0.05em] text-white">
                  A calmer dashboard for theatrical follow-through.
                </h2>
                <p className="max-w-xl text-sm leading-7 text-white/76">
                  Poster-led search, status-grouped watchlists, recent change feed, and settings
                  designed around one thing: your local market.
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-[calc(var(--radius-card)+4px)] border border-white/10 bg-white/8 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-white/45">Your area</p>
                      <p className="mt-2 font-display text-3xl tracking-[-0.04em] text-white">
                        Lower Manhattan
                      </p>
                    </div>
                    <MetaPill className="border-white/10 bg-white/10 text-white/78">
                      Live updates on
                    </MetaPill>
                  </div>
                </div>

                <div className="grid gap-3">
                  {[
                    ["Now playing", "2 titles", "Theatre count expanding"],
                    ["Advance tickets", "3 titles", "New showtimes landed"],
                    ["Coming soon", "6 titles", "Watching for first schedule"],
                  ].map(([label, total, copy]) => (
                    <div
                      key={label}
                      className="rounded-[calc(var(--radius-card)+2px)] border border-white/10 bg-white/6 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-white">{label}</p>
                        <p className="text-xs uppercase tracking-[0.24em] text-white/45">{total}</p>
                      </div>
                      <p className="mt-2 text-sm text-white/72">{copy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "Track what matters",
              copy: "Search by title, follow the releases you care about, and let CineCue ignore the rest.",
            },
            {
              title: "Stay local",
              copy: "Anchor every read to a saved ZIP so status, theatres, and showtimes stay grounded in a real market.",
            },
            {
              title: "React faster",
              copy: "Use live refresh, install support, and tailored alerts when a movie shifts from anticipation to availability.",
            },
          ].map((feature) => (
            <Panel key={feature.title} className="p-6 sm:p-7" tone="soft">
              <div className="space-y-3">
                <h3 className="font-display text-3xl tracking-[-0.04em] text-[color:var(--foreground)]">
                  {feature.title}
                </h3>
                <p className="text-sm leading-7 text-[color:var(--foreground-muted)]">{feature.copy}</p>
              </div>
            </Panel>
          ))}
        </section>
      </div>
    </PageShell>
  );
}
