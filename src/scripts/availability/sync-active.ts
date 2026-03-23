import { enqueueActiveLocationSyncs } from "@/modules/availability/jobs";
import { runTrackedWorkerJob } from "@/modules/ops/worker-runtime";
import { getArg, runCli } from "@/scripts/_internal/cli";

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

void runCli(main, "Active location sync enqueue");
