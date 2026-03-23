import type { Metadata } from "next";
import { auth } from "@/auth";
import { PageHero, PageShell } from "@/app/_components/app-shell";
import { SignOutButton } from "@/app/_components/auth-buttons";
import { MovieDetailClient } from "./_components/movie-detail-client";
import { ActionLink, ArrowLeftIcon, BellIcon } from "@/shared/ui/ui";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Movie Detail",
  description: "Inspect local showtimes, nearby theatres, and follow state for a specific movie.",
};

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
    <PageShell width="wide">
      <div className="space-y-6">
        <PageHero
          actions={
            <>
              <ActionLink href="/dashboard" icon={<ArrowLeftIcon />} size="lg">
                Back to dashboard
              </ActionLink>
              <ActionLink href="/settings/notifications" icon={<BellIcon />} size="lg">
                Notification settings
              </ActionLink>
              <SignOutButton size="lg" variant="primary" />
            </>
          }
          description="Inspect the local theatrical life of a single movie: status, next showings, nearby theatres, and your follow state."
          title="Movie availability"
        />

        <MovieDetailClient movieId={movieId} requestedLocationId={requestedLocationId} />
      </div>
    </PageShell>
  );
}
