import { Worker } from "bullmq";
import { getServerEnv } from "../lib/env";
import { syncZipPhaseOne } from "../lib/phase1/sync";

const env = getServerEnv();
const queueName = "phase1-provider-sync";

const worker = new Worker(
  queueName,
  async (job) => {
    switch (job.name) {
      case "sync-zip":
        return syncZipPhaseOne({
          zip: job.data.zip,
          startDate: job.data.startDate,
          numDays: job.data.numDays,
          radiusMiles: job.data.radiusMiles,
          country: job.data.country,
        });

      default:
        throw new Error(`Unknown job "${job.name}"`);
    }
  },
  {
    connection: {
      url: env.REDIS_URL,
      maxRetriesPerRequest: null,
    },
  },
);

worker.on("completed", (job, result) => {
  console.log(`[worker] completed ${job?.id}`, result);
});

worker.on("failed", (job, error) => {
  console.error(`[worker] failed ${job?.id}`, error);
});

async function main() {
  console.log(`[worker] listening on queue "${queueName}"`);
}

async function shutdown() {
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch(async (error) => {
  console.error("[worker] startup failed", error);
  await shutdown();
});
