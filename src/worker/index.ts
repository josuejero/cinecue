import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { getServerEnv } from "../lib/env";

const env = getServerEnv();
const queueName = "phase0-bootstrap";

const queueConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const workerConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const queue = new Queue(queueName, {
  connection: queueConnection,
});

const worker = new Worker(
  queueName,
  async (job) => {
    console.log(`[worker] processing ${job.name}`, job.data);

    return {
      ok: true,
      processedAt: new Date().toISOString(),
    };
  },
  {
    connection: workerConnection,
  },
);

worker.on("completed", (job, result) => {
  console.log(`[worker] completed ${job?.id}`, result);
});

worker.on("failed", (job, error) => {
  console.error(`[worker] failed ${job?.id}`, error);
});

async function main() {
  await queue.add("bootstrap-check", {
    phase: 0,
    requestedAt: new Date().toISOString(),
  });

  console.log(`[worker] listening on queue "${queueName}"`);
}

async function shutdown() {
  await worker.close();
  await queue.close();
  await queueConnection.quit();
  await workerConnection.quit();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch(async (error) => {
  console.error("[worker] startup failed", error);
  await shutdown();
});
