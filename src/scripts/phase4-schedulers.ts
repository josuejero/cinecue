import { upsertPhase4Schedulers } from "@/lib/phase4/queues";

async function main() {
  const summary = await upsertPhase4Schedulers();
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Phase 4 scheduler bootstrap failed:", error);
  process.exit(1);
});
