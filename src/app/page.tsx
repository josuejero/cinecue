import { auth } from "@/auth";
import { SignInButton } from "@/components/auth-buttons";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  const githubConfigured =
    Boolean(process.env.AUTH_GITHUB_ID) && Boolean(process.env.AUTH_GITHUB_SECRET);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-12 px-6 py-12">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
            CineCue
          </p>
          <h1 className="max-w-4xl text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            Follow movies. Watch local availability change over time.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-600">
            CineCue is not trying to be a giant movie database. It is a focused local
            availability dashboard built around the movies you follow, the theatres near
            you, and the status changes that matter.
          </p>

          {githubConfigured ? (
            <SignInButton className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-700">
              Continue with GitHub
            </SignInButton>
          ) : (
            <div className="inline-flex rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              GitHub auth is not configured yet. Set AUTH_GITHUB_ID and AUTH_GITHUB_SECRET
              to turn on sign-in.
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Phase 3 MVP in this pass</h2>
          <ul className="mt-5 space-y-3 text-sm text-slate-600">
            <li>- Sign in and save a ZIP code</li>
            <li>- Search and follow titles</li>
            <li>- Dashboard grouped by local status</li>
            <li>- Movie detail page with nearby theatres and next showings</li>
            <li>- Notification settings with email-first alerts</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
