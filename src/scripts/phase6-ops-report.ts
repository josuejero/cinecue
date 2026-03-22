import { getPhase6OperationalSnapshot } from "@/lib/phase6/ops";

async function main() {
  const snapshot = await getPhase6OperationalSnapshot();
  console.log(JSON.stringify(snapshot, null, 2));
}

main().catch((error) => {
  console.error("Phase 6 ops report failed:", error);
  process.exit(1);
});
