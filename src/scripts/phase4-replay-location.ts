import { runTrackedWorkerJob } from "@/lib/phase4/operations";
import { replayLocationNow } from "@/lib/phase4/sync";

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

main().catch((error) => {
  console.error("Phase 4 location replay failed:", error);
  process.exit(1);
});
