const checklist = [
  "Placeholder app deploys",
  "Readiness endpoint checks Postgres and Redis",
  "BullMQ worker runs in non-production",
  "Drizzle migration flow is wired",
  "ADR, glossary, milestone plan, and incident ownership docs exist",
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
          CineCue
        </p>
        <h1 className="text-4xl font-bold tracking-tight">
          Phase 0 foundation is in place
        </h1>
        <p className="text-lg text-gray-600">
          This build is intentionally narrow. It proves the repository, runtime,
          worker, database, cache, and delivery conventions before feature work starts.
        </p>
      </div>

      <section className="rounded-2xl border p-6">
        <h2 className="mb-4 text-xl font-semibold">Phase 0 checklist</h2>
        <ul className="space-y-2 text-sm text-gray-700">
          {checklist.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border p-6">
        <h2 className="mb-4 text-xl font-semibold">Useful endpoints</h2>
        <div className="space-y-2 text-sm">
          <a className="block underline" href="/api/health">
            /api/health
          </a>
          <a className="block underline" href="/api/ready">
            /api/ready
          </a>
        </div>
      </section>
    </main>
  );
}