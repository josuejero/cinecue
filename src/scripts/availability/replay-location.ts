import { replayLocationNow } from "@/modules/availability/jobs";
import { runTrackedWorkerJob } from "@/modules/ops/worker-runtime";
import { getArg, runCli } from "@/scripts/_internal/cli";

async function main() {
  const locationId = getArg("location-id");
  if (!locationId) {
    throw new Error("Provide --location-id.");
  }

  const startDate = getArg("start-date") ?? new Date().toISOString().slice(0, 10);
  const numDays = Number(getArg("num-days") ?? 14);

  const summary = await runTrackedWorkerJob(
    {
      queueName: "manual",
      jobName: "replay-location",
      locationId,
      payload: { locationId, startDate, numDays },
      attempt: 1,
    },
    async () =>
      replayLocationNow({
        locationId,
        startDate,
        numDays,
      }),
  );

  console.log(JSON.stringify(summary, null, 2));
}

void runCli(main, "Location replay");
