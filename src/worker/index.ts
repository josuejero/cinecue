import { Job, UnrecoverableError, Worker } from "bullmq";
import { getBullmqConnection } from "@/shared/infra/redis";
import { getServerEnv } from "@/shared/infra/env";
import { syncAvailabilityByZip } from "@/modules/availability/ingestion/sync";
import {
  enqueueActiveLocationSyncs,
  replayLocationNow,
  replayMovieNow,
  runRuntimeCleanup,
  syncFutureReleaseCatalog,
  syncLocationCluster,
} from "@/modules/availability/jobs";
import {
  AVAILABILITY_INGESTION_QUEUE,
  AVAILABILITY_SYNC_QUEUE,
  NOTIFICATIONS_DELIVERY_QUEUE,
  upsertWorkerSchedulers,
} from "@/modules/availability/queues";
import { processPendingEmailNotifications } from "@/modules/notifications/email";
import { processPendingPushNotifications } from "@/modules/notifications/push";
import { writeErrorLog, writeLog } from "@/modules/ops/logging";
import { runTrackedWorkerJob } from "@/modules/ops/worker-runtime";

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

const availabilityIngestionWorker = new Worker(
  AVAILABILITY_INGESTION_QUEUE,
  async (job) => {
    switch (job.name) {
      case "sync-zip":
        return runTrackedWorkerJob(
          trackingForJob(
            AVAILABILITY_INGESTION_QUEUE,
            job,
            null,
            typeof job.data?.zip === "string" ? `availability-by-zip:${job.data.zip}` : null,
          ),
          async () =>
            syncAvailabilityByZip({
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
        throw new UnrecoverableError(`Unknown availability ingestion job "${job.name}"`);
    }
  },
  {
    connection,
    concurrency: 2,
  },
);

const availabilitySyncWorker = new Worker(
  AVAILABILITY_SYNC_QUEUE,
  async (job) => {
    switch (job.name) {
      case "sync-active-locations":
        return runTrackedWorkerJob(
          trackingForJob(AVAILABILITY_SYNC_QUEUE, job),
          async () =>
            enqueueActiveLocationSyncs(
              Number(job.data?.limit ?? env.AVAILABILITY_ACTIVE_LOCATION_LIMIT),
            ),
        );

      case "sync-location": {
        const locationId = requiredString(job.data?.locationId, "locationId");

        return runTrackedWorkerJob(
          trackingForJob(
            AVAILABILITY_SYNC_QUEUE,
            job,
            locationId,
            `sync-location:${locationId}`,
          ),
          async () =>
            syncLocationCluster({
              locationId,
              reason: typeof job.data?.reason === "string" ? job.data.reason : "worker",
              startDate: typeof job.data?.startDate === "string" ? job.data.startDate : null,
              numDays: typeof job.data?.numDays === "number" ? job.data.numDays : null,
            }),
        );
      }

      case "sync-future-releases":
        return runTrackedWorkerJob(
          trackingForJob(AVAILABILITY_SYNC_QUEUE, job),
          async () =>
            syncFutureReleaseCatalog({
              releaseDate:
                typeof job.data?.releaseDate === "string" ? job.data.releaseDate : undefined,
              numDays:
                typeof job.data?.numDays === "number"
                  ? job.data.numDays
                  : env.CATALOG_FUTURE_RELEASES_NUM_DAYS,
              country:
                (job.data?.country as "USA" | "CAN" | undefined) ?? env.AVAILABILITY_SYNC_COUNTRY,
            }),
        );

      case "cleanup-runtime-data":
        return runTrackedWorkerJob(
          trackingForJob(AVAILABILITY_SYNC_QUEUE, job),
          async () =>
            runRuntimeCleanup({
              showtimeRetentionDays: Number(
                job.data?.showtimeRetentionDays ?? env.AVAILABILITY_SHOWTIME_RETENTION_DAYS,
              ),
              jobRunRetentionDays: Number(
                job.data?.jobRunRetentionDays ?? env.WORKER_JOB_RUN_RETENTION_DAYS,
              ),
            }),
        );

      case "replay-location": {
        const locationId = requiredString(job.data?.locationId, "locationId");

        return runTrackedWorkerJob(
          trackingForJob(
            AVAILABILITY_SYNC_QUEUE,
            job,
            locationId,
            `replay-location:${locationId}`,
          ),
          async () =>
            replayLocationNow({
              locationId,
              startDate: typeof job.data?.startDate === "string" ? job.data.startDate : null,
              numDays: typeof job.data?.numDays === "number" ? job.data.numDays : null,
            }),
        );
      }

      case "replay-movie": {
        const locationId = requiredString(job.data?.locationId, "locationId");
        const movieId = requiredString(job.data?.movieId, "movieId");

        return runTrackedWorkerJob(
          trackingForJob(
            AVAILABILITY_SYNC_QUEUE,
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
        throw new UnrecoverableError(`Unknown availability sync job "${job.name}"`);
    }
  },
  {
    connection,
    concurrency: env.WORKER_LOCATION_SYNC_CONCURRENCY,
  },
);

const notificationsDeliveryWorker = new Worker(
  NOTIFICATIONS_DELIVERY_QUEUE,
  async (job) => {
    switch (job.name) {
      case "send-email-notifications":
        return runTrackedWorkerJob(
          trackingForJob(
            NOTIFICATIONS_DELIVERY_QUEUE,
            job,
            typeof job.data?.locationId === "string" ? job.data.locationId : null,
            `send-email-notifications:${job.data?.locationId ?? "all"}`,
          ),
          async () =>
            processPendingEmailNotifications({
              locationId:
                typeof job.data?.locationId === "string" ? job.data.locationId : null,
              limit: Number(job.data?.limit ?? env.NOTIFICATIONS_EMAIL_BATCH_SIZE),
              dryRun: Boolean(job.data?.dryRun),
            }),
        );

      case "send-push-notifications":
        return runTrackedWorkerJob(
          trackingForJob(
            NOTIFICATIONS_DELIVERY_QUEUE,
            job,
            typeof job.data?.locationId === "string" ? job.data.locationId : null,
            `send-push-notifications:${job.data?.locationId ?? "all"}`,
          ),
          async () =>
            processPendingPushNotifications({
              locationId:
                typeof job.data?.locationId === "string" ? job.data.locationId : null,
              limit: Number(job.data?.limit ?? env.NOTIFICATIONS_PUSH_BATCH_SIZE),
              dryRun: Boolean(job.data?.dryRun),
            }),
        );

      default:
        throw new UnrecoverableError(`Unknown notifications delivery job "${job.name}"`);
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

wireWorker("availability-ingestion", availabilityIngestionWorker);
wireWorker("availability-sync", availabilitySyncWorker);
wireWorker("notifications-delivery", notificationsDeliveryWorker);

async function main() {
  const schedulerSummary = await upsertWorkerSchedulers();

  writeLog("info", "worker.boot", {
    availabilityIngestionQueue: AVAILABILITY_INGESTION_QUEUE,
    availabilitySyncQueue: AVAILABILITY_SYNC_QUEUE,
    notificationsDeliveryQueue: NOTIFICATIONS_DELIVERY_QUEUE,
    schedulerSummary,
  });
}

async function shutdown() {
  await Promise.all([
    availabilityIngestionWorker.close(),
    availabilitySyncWorker.close(),
    notificationsDeliveryWorker.close(),
  ]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch(async (error) => {
  writeErrorLog("worker.startup_failed", error);
  await shutdown();
});
