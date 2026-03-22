import type { Metadata } from "next";
import { auth } from "@/auth";
import { PageHero, PageHeroMeta, PageShell } from "@/components/app-shell";
import { SignOutButton } from "@/components/auth-buttons";
import { DashboardClient } from "@/components/dashboard-client";
import { ActionLink, BellIcon, MapPinIcon } from "@/components/ui";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Track followed movies by local theatrical status, nearby theatres, and recent availability changes.",
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  return (
    <PageShell width="wide">
      <div className="space-y-6">
        <PageHero
          actions={
            <>
              <ActionLink href="/settings/locations" icon={<MapPinIcon />} size="lg">
                Locations
              </ActionLink>
              <ActionLink href="/settings/notifications" icon={<BellIcon />} size="lg">
                Notification settings
              </ActionLink>
              <SignOutButton size="lg" variant="primary" />
            </>
          }
          description="Track followed movies by local status, nearby theatres, and recent availability changes."
          title={`Welcome back${session.user.name ? `, ${session.user.name}` : ""}`}
          meta={
            <PageHeroMeta
              items={[
                "Poster-led follow workflow",
                "Live local refresh",
                "Location-aware availability",
              ]}
            />
          }
        />

        <DashboardClient />
      </div>
    </PageShell>
  );
}
