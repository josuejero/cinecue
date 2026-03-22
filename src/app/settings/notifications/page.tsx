import Link from "next/link";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth-buttons";
import { NotificationSettingsClient } from "@/components/notification-settings-client";
import { redirect } from "next/navigation";

export default async function NotificationSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
      <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            CineCue
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Notification settings
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="inline-flex h-11 items-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-900 transition hover:border-slate-900"
            href="/dashboard"
          >
            Back to dashboard
          </Link>
          <SignOutButton className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700" />
        </div>
      </header>

      <NotificationSettingsClient />
    </main>
  );
}
