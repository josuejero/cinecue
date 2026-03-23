import crypto from "node:crypto";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { locationSyncStates, showtimes, workerJobRuns } from "@/db/schema";
import { listActiveLocationClusters } from "@/modules/availability/location-clusters";
import {
  getAvailabilitySyncQueue,
  getNotificationDeliveryQueue,
} from "@/modules/availability/queues";
import { writeErrorLog, writeLog } from "@/modules/ops/logging";

function createId() {
  return crypto.randomUUID();
}

function serializeUnknown(value: unknown) {
  if (value === undefined) {
    return {};
  }

  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (item instanceof Date) {
        return item.toISOString();
      }

      if (item instanceof Error) {
        return {
          name: item.name,
          message: item.message,
          stack: item.stack ?? null,
        };
      }

      return item;
    }),
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "Unknown worker failure.";
}

export async function beginWorkerJobRun(input: {
  queueName: string;
  jobName: string;
  jobId?: string | null;
  deduplicationKey?: string | null;
  locationId?: string | null;
  payload?: unknown;
  attempt?: number;
}) {
  const db = getDb();
  const id = createId();

  await db.insert(workerJobRuns).values({
    id,
    queueName: input.queueName,
    jobName: input.jobName,
    jobId: input.jobId ?? null,
    deduplicationKey: input.deduplicationKey ?? null,
    locationId: input.locationId ?? null,
    payload: serializeUnknown(input.payload),
    resultSummary: {},
    status: "running",
    attempt: input.attempt ?? 1,
    errorMessage: null,
    startedAt: new Date(),
    finishedAt: null,
    updatedAt: new Date(),
  });

  return id;
}

export async function completeWorkerJobRun(runId: string, resultSummary?: unknown) {
  const db = getDb();

  await db
    .update(workerJobRuns)
    .set({
      status: "succeeded",
      resultSummary: serializeUnknown(resultSummary),
      finishedAt: new Date(),
      updatedAt: new Date(),
      errorMessage: null,
    })
    .where(eq(workerJobRuns.id, runId));
}

export async function failWorkerJobRun(runId: string, error: unknown) {
  const db = getDb();

  await db
    .update(workerJobRuns)
    .set({
      status: "failed",
      errorMessage: getErrorMessage(error),
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workerJobRuns.id, runId));
}

export async function runTrackedWorkerJob<T>(
  input: {
    queueName: string;
    jobName: string;
    jobId?: string | null;
    deduplicationKey?: string | null;
    locationId?: string | null;
    payload?: unknown;
    attempt?: number;
  },
  handler: () => Promise<T>,
) {
  const runId = await beginWorkerJobRun(input);

  writeLog("info", "worker.job.started", {
    runId,
    queueName: input.queueName,
    jobName: input.jobName,
    jobId: input.jobId ?? null,
    locationId: input.locationId ?? null,
    attempt: input.attempt ?? 1,
  });

  try {
    const result = await handler();
    await completeWorkerJobRun(runId, result);

    writeLog("info", "worker.job.completed", {
      runId,
      queueName: input.queueName,
      jobName: input.jobName,
      jobId: input.jobId ?? null,
      locationId: input.locationId ?? null,
    });

    return result;
  } catch (error) {
    await failWorkerJobRun(runId, error);

    writeErrorLog("worker.job.failed", error, {
      runId,
      queueName: input.queueName,
      jobName: input.jobName,
      jobId: input.jobId ?? null,
      locationId: input.locationId ?? null,
    });

    throw error;
  }
}

export async function touchLocationSyncState(input: {
  locationId: string;
  lastShowingsSyncRunId?: string | null;
  lastShowingsSyncAt?: Date | null;
  lastReadModelRefreshAt?: Date | null;
  lastNotificationEnqueueAt?: Date | null;
  lastSuccessfulSyncAt?: Date | null;
  staleAfterSeconds?: number;
}) {
  const db = getDb();

  const insertValues = {
    locationId: input.locationId,
    staleAfterSeconds: input.staleAfterSeconds ?? 5400,
    updatedAt: new Date(),
    ...(input.lastShowingsSyncRunId !== undefined
      ? { lastShowingsSyncRunId: input.lastShowingsSyncRunId }
      : {}),
    ...(input.lastShowingsSyncAt !== undefined
      ? { lastShowingsSyncAt: input.lastShowingsSyncAt }
      : {}),
    ...(input.lastReadModelRefreshAt !== undefined
      ? { lastReadModelRefreshAt: input.lastReadModelRefreshAt }
      : {}),
    ...(input.lastNotificationEnqueueAt !== undefined
      ? { lastNotificationEnqueueAt: input.lastNotificationEnqueueAt }
      : {}),
    ...(input.lastSuccessfulSyncAt !== undefined
      ? { lastSuccessfulSyncAt: input.lastSuccessfulSyncAt }
      : {}),
  };

  const updateValues = {
    staleAfterSeconds: input.staleAfterSeconds ?? 5400,
    updatedAt: new Date(),
    ...(input.lastShowingsSyncRunId !== undefined
      ? { lastShowingsSyncRunId: input.lastShowingsSyncRunId }
      : {}),
    ...(input.lastShowingsSyncAt !== undefined
      ? { lastShowingsSyncAt: input.lastShowingsSyncAt }
      : {}),
    ...(input.lastReadModelRefreshAt !== undefined
      ? { lastReadModelRefreshAt: input.lastReadModelRefreshAt }
      : {}),
    ...(input.lastNotificationEnqueueAt !== undefined
      ? { lastNotificationEnqueueAt: input.lastNotificationEnqueueAt }
      : {}),
    ...(input.lastSuccessfulSyncAt !== undefined
      ? { lastSuccessfulSyncAt: input.lastSuccessfulSyncAt }
      : {}),
  };

  await db
    .insert(locationSyncStates)
    .values(insertValues)
    .onConflictDoUpdate({
      target: locationSyncStates.locationId,
      set: updateValues,
    });
}

export async function listStaleLocations(limit = 50) {
  const clusters = await listActiveLocationClusters(Math.max(limit, 500));
  const now = Date.now();

  return clusters
    .filter((cluster) => {
      if (!cluster.lastSuccessfulSyncAt) {
        return true;
      }

      return now - cluster.lastSuccessfulSyncAt.getTime() > cluster.staleAfterSeconds * 1000;
    })
    .slice(0, limit);
}

export async function cleanupOldShowtimeRows(retentionDays: number) {
  const db = getDb();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const deleted = await db
    .delete(showtimes)
    .where(lt(showtimes.businessDate, cutoff))
    .returning({ id: showtimes.id });

  return {
    retentionDays,
    cutoff,
    deleted: deleted.length,
  };
}

export async function cleanupOldWorkerJobRuns(retentionDays: number) {
  const db = getDb();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const deleted = await db
    .delete(workerJobRuns)
    .where(
      and(
        lt(workerJobRuns.finishedAt, cutoff),
        or(eq(workerJobRuns.status, "succeeded"), eq(workerJobRuns.status, "failed")),
      ),
    )
    .returning({ id: workerJobRuns.id });

  return {
    retentionDays,
    cutoff: cutoff.toISOString(),
    deleted: deleted.length,
  };
}

export async function getWorkerOperationalSnapshot() {
  const db = getDb();
  const syncQueue = getAvailabilitySyncQueue();
  const notificationQueue = getNotificationDeliveryQueue();

  const [syncQueueCounts, notificationQueueCounts, staleLocations, recentFailures] =
    await Promise.all([
      syncQueue.getJobCounts("active", "completed", "delayed", "failed", "waiting", "prioritized"),
      notificationQueue.getJobCounts(
        "active",
        "completed",
        "delayed",
        "failed",
        "waiting",
        "prioritized",
      ),
      listStaleLocations(25),
      db
        .select({
          id: workerJobRuns.id,
          queueName: workerJobRuns.queueName,
          jobName: workerJobRuns.jobName,
          jobId: workerJobRuns.jobId,
          locationId: workerJobRuns.locationId,
          errorMessage: workerJobRuns.errorMessage,
          startedAt: workerJobRuns.startedAt,
          finishedAt: workerJobRuns.finishedAt,
        })
        .from(workerJobRuns)
        .where(eq(workerJobRuns.status, "failed"))
        .orderBy(desc(workerJobRuns.startedAt))
        .limit(10),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    queues: {
      sync: syncQueueCounts,
      delivery: notificationQueueCounts,
    },
    staleLocationCount: staleLocations.length,
    staleLocations,
    recentFailures,
  };
}
