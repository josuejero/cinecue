import { runTrackedWorkerJob } from "@/lib/phase4/operations";
import { enqueueActiveLocationSyncs } from "@/lib/phase4/sync";

function getArg(name: string) {
  const args = process.argv.slice(2);
  const exact = `--${name}`;
  const prefixed = `--${name}=`;

  const prefixedArg = args.find((arg) => arg.startsWith(prefixed));
  if (prefixedArg) {
    return prefixedArg.slice(prefixed.length);
  }

  const exactIndex = args.findIndex((arg) => arg === exact);
  if (exactIndex >= 0 && args[exactIndex + 1]) {
    return args[exactIndex + 1];
  }

  return undefined;
}

async function main() {
  const limit = Number(getArg("limit") ?? 100);

  const summary = await runTrackedWorkerJob(
    {
      queueName: "manual",
      jobName: "sync-active-locations",
      payload: { limit },
      attempt: 1,
    },
    async () => enqueueActiveLocationSyncs(limit),
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Phase 4 active sync enqueue failed:", error);
  process.exit(1);
});
