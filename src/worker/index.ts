import { Job, UnrecoverableError, Worker } from "bullmq";
import { getServerEnv } from "@/lib/env";
import { syncZipPhaseOne } from "@/lib/phase1/sync";
import { processPendingEmailNotifications } from "@/lib/phase3/notifications";
import { writeErrorLog, writeLog } from "@/lib/phase4/logging";
import { runTrackedWorkerJob } from "@/lib/phase4/operations";
import {
  PHASE1_PROVIDER_SYNC_QUEUE,
  PHASE4_NOTIFICATION_QUEUE,
  PHASE4_SYNC_QUEUE,
  upsertPhase4Schedulers,
} from "@/lib/phase4/queues";
import {
  enqueueActiveLocationSyncs,
  replayLocationNow,
  replayMovieNow,
  runPhase4Cleanup,
  syncFutureReleaseCatalog,
  syncLocationCluster,
} from "@/lib/phase4/sync";
import { getBullmqConnection } from "@/lib/redis";

const env = getServerEnv();
const connection = getBullmqConnection();

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new UnrecoverableError(`${field} is required.`);
  }

  return value;
}

function trackingForJob(
  queueName: string,
  job: Job,
  locationId?: string | null,
  deduplicationKey?: string | null,
) {
  return {
    queueName,
    jobName: job.name,
    jobId: job.id ?? null,
    deduplicationKey: deduplicationKey ?? null,
    locationId: locationId ?? null,
    payload: job.data,
    attempt: job.attemptsMade + 1,
  };
}

const phase1Worker = new Worker(
  PHASE1_PROVIDER_SYNC_QUEUE,
  async (job) => {
    switch (job.name) {
      case "sync-zip":
        return runTrackedWorkerJob(
          trackingForJob(
            PHASE1_PROVIDER_SYNC_QUEUE,
            job,
            null,
            typeof job.data?.zip === "string" ? `phase1-sync:${job.data.zip}` : null,
          ),
          async () =>
            syncZipPhaseOne({
              zip: requiredString(job.data?.zip, "zip"),
              startDate:
                typeof job.data?.startDate === "string"
                  ? job.data.startDate
                  : new Date().toISOString().slice(0, 10),
              numDays: Number(job.data?.numDays ?? 7),
              radiusMiles: Number(job.data?.radiusMiles ?? 25),
              country: (job.data?.country as "USA" | "CAN" | undefined) ?? "USA",
            }),
        );

      default:
        throw new UnrecoverableError(`Unknown phase 1 job "${job.name}"`);
    }
  },
  {
    connection,
    concurrency: 2,
  },
);

const phase4SyncWorker = new Worker(
  PHASE4_SYNC_QUEUE,
  async (job) => {
    switch (job.name) {
      case "sync-active-locations":
        return runTrackedWorkerJob(
          trackingForJob(PHASE4_SYNC_QUEUE, job),
          async () =>
            enqueueActiveLocationSyncs(
              Number(job.data?.limit ?? env.PHASE4_ACTIVE_LOCATION_LIMIT),
            ),
        );

      case "sync-location": {
        const locationId = requiredString(job.data?.locationId, "locationId");

        return runTrackedWorkerJob(
          trackingForJob(
            PHASE4_SYNC_QUEUE,
            job,
            locationId,
            `sync-location:${locationId}`,
          ),
          async () =>
            syncLocationCluster({
              locationId,
              reason:
                typeof job.data?.reason === "string" ? job.data.reason : "worker",
              startDate:
                typeof job.data?.startDate === "string" ? job.data.startDate : null,
              numDays:
                typeof job.data?.numDays === "number" ? job.data.numDays : null,
            }),
        );
      }

      case "sync-future-releases":
        return runTrackedWorkerJob(
          trackingForJob(PHASE4_SYNC_QUEUE, job),
          async () =>
            syncFutureReleaseCatalog({
              releaseDate:
                typeof job.data?.releaseDate === "string"
                  ? job.data.releaseDate
                  : undefined,
              numDays:
                typeof job.data?.numDays === "number"
                  ? job.data.numDays
                  : env.PHASE4_FUTURE_RELEASES_NUM_DAYS,
              country:
                (job.data?.country as "USA" | "CAN" | undefined) ??
                env.PHASE4_SYNC_COUNTRY,
            }),
        );

      case "cleanup-phase4-data":
        return runTrackedWorkerJob(
          trackingForJob(PHASE4_SYNC_QUEUE, job),
          async () =>
            runPhase4Cleanup({
              showtimeRetentionDays: Number(
                job.data?.showtimeRetentionDays ?? env.PHASE4_SHOWTIME_RETENTION_DAYS,
              ),
              jobRunRetentionDays: Number(
                job.data?.jobRunRetentionDays ?? env.PHASE4_JOB_RUN_RETENTION_DAYS,
              ),
            }),
        );

      case "replay-location": {
        const locationId = requiredString(job.data?.locationId, "locationId");

        return runTrackedWorkerJob(
          trackingForJob(
            PHASE4_SYNC_QUEUE,
            job,
            locationId,
            `replay-location:${locationId}`,
          ),
          async () =>
            replayLocationNow({
              locationId,
              startDate:
                typeof job.data?.startDate === "string" ? job.data.startDate : null,
              numDays:
                typeof job.data?.numDays === "number" ? job.data.numDays : null,
            }),
        );
      }

      case "replay-movie": {
        const locationId = requiredString(job.data?.locationId, "locationId");
        const movieId = requiredString(job.data?.movieId, "movieId");

        return runTrackedWorkerJob(
          trackingForJob(
            PHASE4_SYNC_QUEUE,
            job,
            locationId,
            `replay-movie:${locationId}:${movieId}`,
          ),
          async () =>
            replayMovieNow({
              locationId,
              movieId,
            }),
        );
      }

      default:
        throw new UnrecoverableError(`Unknown phase 4 sync job "${job.name}"`);
    }
  },
  {
    connection,
    concurrency: env.PHASE4_LOCATION_SYNC_CONCURRENCY,
  },
);

const phase4NotificationWorker = new Worker(
  PHASE4_NOTIFICATION_QUEUE,
  async (job) => {
    switch (job.name) {
      case "send-email-notifications":
        return runTrackedWorkerJob(
          trackingForJob(
            PHASE4_NOTIFICATION_QUEUE,
            job,
            typeof job.data?.locationId === "string" ? job.data.locationId : null,
            `send-email-notifications:${job.data?.locationId ?? "all"}`,
          ),
          async () =>
            processPendingEmailNotifications({
              locationId:
                typeof job.data?.locationId === "string" ? job.data.locationId : null,
              limit: Number(job.data?.limit ?? env.PHASE4_NOTIFICATION_BATCH_SIZE),
              dryRun: Boolean(job.data?.dryRun),
            }),
        );

      default:
        throw new UnrecoverableError(
          `Unknown phase 4 notification job "${job.name}"`,
        );
    }
  },
  {
    connection,
    concurrency: 2,
  },
);

function wireWorker(name: string, worker: Worker) {
  worker.on("completed", (job, result) => {
    writeLog("info", "worker.completed", {
      worker: name,
      queue: worker.name,
      jobId: job?.id ?? null,
      jobName: job?.name ?? null,
      result,
    });
  });

  worker.on("failed", (job, error) => {
    writeErrorLog("worker.failed", error, {
      worker: name,
      queue: worker.name,
      jobId: job?.id ?? null,
      jobName: job?.name ?? null,
    });
  });
}

wireWorker("phase1", phase1Worker);
wireWorker("phase4-sync", phase4SyncWorker);
wireWorker("phase4-notifications", phase4NotificationWorker);

async function main() {
  const schedulerSummary = await upsertPhase4Schedulers();

  writeLog("info", "worker.boot", {
    phase1Queue: PHASE1_PROVIDER_SYNC_QUEUE,
    phase4SyncQueue: PHASE4_SYNC_QUEUE,
    phase4NotificationQueue: PHASE4_NOTIFICATION_QUEUE,
    schedulerSummary,
  });
}

async function shutdown() {
  await Promise.all([
    phase1Worker.close(),
    phase4SyncWorker.close(),
    phase4NotificationWorker.close(),
  ]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch(async (error) => {
  writeErrorLog("worker.startup_failed", error);
  await shutdown();
});
