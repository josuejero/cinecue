export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
          CineCue
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
          You are offline
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          CineCue can still open previously loaded screens, but live availability
          updates, push enrollment, and provider-backed data need a connection.
        </p>
      </div>
    </main>
  );
}
