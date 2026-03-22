import Link from "next/link";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth-buttons";
import { MovieDetailClient } from "@/components/movie-detail-client";
import { redirect } from "next/navigation";

export default async function MoviePage({
  params,
  searchParams,
}: {
  params: Promise<{ movieId: string }>;
  searchParams: Promise<{ locationId?: string | string[] | undefined }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const { movieId } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedLocationId = Array.isArray(resolvedSearchParams.locationId)
    ? resolvedSearchParams.locationId[0] ?? null
    : resolvedSearchParams.locationId ?? null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8">
      <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="inline-flex h-11 items-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-900 transition hover:border-slate-900"
            href="/dashboard"
          >
            Back to dashboard
          </Link>
          <Link
            className="inline-flex h-11 items-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-900 transition hover:border-slate-900"
            href="/settings/notifications"
          >
            Notification settings
          </Link>
        </div>

        <SignOutButton className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700" />
      </header>

      <MovieDetailClient movieId={movieId} requestedLocationId={requestedLocationId} />
    </main>
  );
}
