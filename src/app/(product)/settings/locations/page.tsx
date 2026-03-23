import type { Metadata } from "next";
import { auth } from "@/auth";
import { PageHero, PageShell } from "@/app/_components/app-shell";
import { SignOutButton } from "@/app/_components/auth-buttons";
import { LocationsSettingsClient } from "./_components/locations-settings-client";
import { ActionLink, ArrowLeftIcon } from "@/shared/ui/ui";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Location Settings",
  description: "Manage saved markets, set your default location, and review local follow context.",
};

export default async function LocationsSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  return (
    <PageShell width="narrow">
      <div className="space-y-6">
        <PageHero
          actions={
            <>
              <ActionLink href="/dashboard" icon={<ArrowLeftIcon />} size="lg">
                Back to dashboard
              </ActionLink>
              <SignOutButton size="lg" variant="primary" />
            </>
          }
          description="Manage multiple saved areas, keep a default, and review location-specific follow and theatre counts."
          title="Location settings"
        />

        <LocationsSettingsClient />
      </div>
    </PageShell>
  );
}
