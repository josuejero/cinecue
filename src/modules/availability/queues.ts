import { Queue } from "bullmq";
import { getServerEnv } from "@/shared/infra/env";
import { getBullmqConnection } from "@/shared/infra/redis";

export const AVAILABILITY_INGESTION_QUEUE = "availability-ingestion";
export const AVAILABILITY_SYNC_QUEUE = "availability-sync";
export const NOTIFICATIONS_DELIVERY_QUEUE = "notifications-delivery";

export type AvailabilitySyncJobName =
  | "sync-active-locations"
  | "sync-location"
  | "sync-future-releases"
  | "cleanup-runtime-data"
  | "replay-location"
  | "replay-movie";

export type NotificationDeliveryJobName =
  | "send-email-notifications"
  | "send-push-notifications";

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 5_000,
  },
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
};

declare global {
  var __cinecueAvailabilitySyncQueue: Queue | undefined;
  var __cinecueNotificationsDeliveryQueue: Queue | undefined;
}

export async function closeAvailabilityQueues() {
  await Promise.all([
    global.__cinecueAvailabilitySyncQueue?.close(),
    global.__cinecueNotificationsDeliveryQueue?.close(),
  ]);

  global.__cinecueAvailabilitySyncQueue = undefined;
  global.__cinecueNotificationsDeliveryQueue = undefined;
}

export function getAvailabilitySyncQueue() {
  if (!global.__cinecueAvailabilitySyncQueue) {
    global.__cinecueAvailabilitySyncQueue = new Queue(AVAILABILITY_SYNC_QUEUE, {
      connection: getBullmqConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }

  return global.__cinecueAvailabilitySyncQueue;
}

export function getNotificationDeliveryQueue() {
  if (!global.__cinecueNotificationsDeliveryQueue) {
    global.__cinecueNotificationsDeliveryQueue = new Queue(NOTIFICATIONS_DELIVERY_QUEUE, {
      connection: getBullmqConnection(),
      defaultJobOptions: {
        ...DEFAULT_JOB_OPTIONS,
        attempts: 2,
        backoff: {
          type: "fixed" as const,
          delay: 5_000,
        },
      },
    });
  }

  return global.__cinecueNotificationsDeliveryQueue;
}

export async function upsertWorkerSchedulers() {
  const env = getServerEnv();

  if (env.WORKER_ENABLE_SCHEDULERS === "false") {
    return {
      enabled: false,
      schedulers: [] as string[],
    };
  }

  const syncQueue = getAvailabilitySyncQueue();
  const notificationQueue = getNotificationDeliveryQueue();

  await syncQueue.upsertJobScheduler(
    "availability:sync-active-locations",
    { every: env.AVAILABILITY_SYNC_INTERVAL_MINUTES * 60_000 },
    {
      name: "sync-active-locations",
      data: {
        limit: env.AVAILABILITY_ACTIVE_LOCATION_LIMIT,
      },
      opts: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 1_000,
      },
    },
  );

  await notificationQueue.upsertJobScheduler(
    "notifications:send-email",
    { every: env.NOTIFICATIONS_EMAIL_INTERVAL_MINUTES * 60_000 },
    {
      name: "send-email-notifications",
      data: {
        limit: env.NOTIFICATIONS_EMAIL_BATCH_SIZE,
      },
      opts: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 1_000,
      },
    },
  );

  await notificationQueue.upsertJobScheduler(
    "notifications:send-push",
    { every: env.NOTIFICATIONS_PUSH_INTERVAL_MINUTES * 60_000 },
    {
      name: "send-push-notifications",
      data: {
        limit: env.NOTIFICATIONS_PUSH_BATCH_SIZE,
      },
      opts: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 1_000,
      },
    },
  );

  await syncQueue.upsertJobScheduler(
    "catalog:sync-future-releases",
    { every: env.CATALOG_FUTURE_RELEASES_INTERVAL_MINUTES * 60_000 },
    {
      name: "sync-future-releases",
      data: {
        numDays: env.CATALOG_FUTURE_RELEASES_NUM_DAYS,
        country: env.AVAILABILITY_SYNC_COUNTRY,
      },
      opts: {
        attempts: 2,
        removeOnComplete: 100,
        removeOnFail: 1_000,
      },
    },
  );

  await syncQueue.upsertJobScheduler(
    "ops:cleanup-runtime-data",
    { pattern: "0 30 3 * * *" },
    {
      name: "cleanup-runtime-data",
      data: {
        showtimeRetentionDays: env.AVAILABILITY_SHOWTIME_RETENTION_DAYS,
        jobRunRetentionDays: env.WORKER_JOB_RUN_RETENTION_DAYS,
      },
      opts: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 1_000,
      },
    },
  );

  return {
    enabled: true,
    schedulers: [
      "availability:sync-active-locations",
      "notifications:send-email",
      "notifications:send-push",
      "catalog:sync-future-releases",
      "ops:cleanup-runtime-data",
    ],
  };
}

export async function enqueueLocationSync(input: {
  locationId: string;
  reason?: string;
  startDate?: string;
  numDays?: number;
}) {
  return getAvailabilitySyncQueue().add(
    "sync-location",
    {
      locationId: input.locationId,
      reason: input.reason ?? "scheduled",
      startDate: input.startDate ?? null,
      numDays: input.numDays ?? null,
    },
    {
      deduplication: {
        id: `sync-location:${input.locationId}`,
      },
    },
  );
}

export async function enqueueEmailNotificationProcessing(input?: {
  locationId?: string | null;
  reason?: string;
  limit?: number;
}) {
  return getNotificationDeliveryQueue().add(
    "send-email-notifications",
    {
      locationId: input?.locationId ?? null,
      reason: input?.reason ?? "manual",
      limit: input?.limit ?? null,
    },
    {
      deduplication: {
        id: `send-email-notifications:${input?.locationId ?? "all"}`,
      },
    },
  );
}

export async function enqueuePushDeliveryProcessing(input?: {
  locationId?: string | null;
  reason?: string;
  limit?: number;
}) {
  return getNotificationDeliveryQueue().add(
    "send-push-notifications",
    {
      locationId: input?.locationId ?? null,
      reason: input?.reason ?? "manual",
      limit: input?.limit ?? null,
    },
    {
      deduplication: {
        id: `send-push-notifications:${input?.locationId ?? "all"}`,
      },
    },
  );
}

export async function enqueueLocationReplay(input: {
  locationId: string;
  startDate?: string;
  numDays?: number;
}) {
  return getAvailabilitySyncQueue().add(
    "replay-location",
    {
      locationId: input.locationId,
      startDate: input.startDate ?? null,
      numDays: input.numDays ?? null,
    },
    {
      deduplication: {
        id: `replay-location:${input.locationId}:${input.startDate ?? "today"}:${input.numDays ?? 0}`,
      },
    },
  );
}

export async function enqueueMovieReplay(input: {
  locationId: string;
  movieId: string;
}) {
  return getAvailabilitySyncQueue().add(
    "replay-movie",
    {
      locationId: input.locationId,
      movieId: input.movieId,
    },
    {
      deduplication: {
        id: `replay-movie:${input.locationId}:${input.movieId}`,
      },
    },
  );
}
