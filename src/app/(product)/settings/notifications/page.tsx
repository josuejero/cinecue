import type { Metadata } from "next";
import { auth } from "@/auth";
import { PageHero, PageShell } from "@/shared/ui/app-shell";
import { SignOutButton } from "@/shared/ui/auth-buttons";
import { NotificationSettingsClient } from "./_components/notification-settings-client";
import { ActionLink, ArrowLeftIcon } from "@/shared/ui/ui";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Notification Settings",
  description: "Control email and browser push delivery for CineCue's local movie alerts.",
};

export default async function NotificationSettingsPage() {
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
          description="Tune delivery channels and event-level alert rules for the changes you actually want to hear about."
          title="Notification settings"
        />

        <NotificationSettingsClient />
      </div>
    </PageShell>
  );
}
