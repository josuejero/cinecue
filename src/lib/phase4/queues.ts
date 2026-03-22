import { Queue } from "bullmq";
import { getServerEnv } from "@/lib/env";
import { getBullmqConnection } from "@/lib/redis";

export const PHASE1_PROVIDER_SYNC_QUEUE = "phase1-provider-sync";
export const PHASE4_SYNC_QUEUE = "phase4-sync";
export const PHASE4_NOTIFICATION_QUEUE = "phase4-notifications";

export type Phase4SyncJobName =
  | "sync-active-locations"
  | "sync-location"
  | "sync-future-releases"
  | "cleanup-phase4-data"
  | "replay-location"
  | "replay-movie";

export type Phase4NotificationJobName = "send-email-notifications";

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
  var __cinecuePhase4SyncQueue: Queue | undefined;
  var __cinecuePhase4NotificationQueue: Queue | undefined;
}

export function getPhase4SyncQueue() {
  if (!global.__cinecuePhase4SyncQueue) {
    global.__cinecuePhase4SyncQueue = new Queue(PHASE4_SYNC_QUEUE, {
      connection: getBullmqConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }

  return global.__cinecuePhase4SyncQueue;
}

export function getPhase4NotificationQueue() {
  if (!global.__cinecuePhase4NotificationQueue) {
    global.__cinecuePhase4NotificationQueue = new Queue(PHASE4_NOTIFICATION_QUEUE, {
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

  return global.__cinecuePhase4NotificationQueue;
}

export async function upsertPhase4Schedulers() {
  const env = getServerEnv();

  if (env.PHASE4_ENABLE_SCHEDULERS === "false") {
    return {
      enabled: false,
      schedulers: [] as string[],
    };
  }

  const syncQueue = getPhase4SyncQueue();
  const notificationQueue = getPhase4NotificationQueue();

  await syncQueue.upsertJobScheduler(
    "phase4:sync-active-locations",
    { every: env.PHASE4_SYNC_INTERVAL_MINUTES * 60_000 },
    {
      name: "sync-active-locations",
      data: {
        limit: env.PHASE4_ACTIVE_LOCATION_LIMIT,
      },
      opts: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 1_000,
      },
    },
  );

  await notificationQueue.upsertJobScheduler(
    "phase4:send-email-notifications",
    { every: env.PHASE4_NOTIFICATION_INTERVAL_MINUTES * 60_000 },
    {
      name: "send-email-notifications",
      data: {
        limit: env.PHASE4_NOTIFICATION_BATCH_SIZE,
      },
      opts: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 1_000,
      },
    },
  );

  await syncQueue.upsertJobScheduler(
    "phase4:sync-future-releases",
    { every: env.PHASE4_FUTURE_RELEASES_INTERVAL_MINUTES * 60_000 },
    {
      name: "sync-future-releases",
      data: {
        numDays: env.PHASE4_FUTURE_RELEASES_NUM_DAYS,
        country: env.PHASE4_SYNC_COUNTRY,
      },
      opts: {
        attempts: 2,
        removeOnComplete: 100,
        removeOnFail: 1_000,
      },
    },
  );

  await syncQueue.upsertJobScheduler(
    "phase4:cleanup-phase4-data",
    { pattern: "0 30 3 * * *" },
    {
      name: "cleanup-phase4-data",
      data: {
        showtimeRetentionDays: env.PHASE4_SHOWTIME_RETENTION_DAYS,
        jobRunRetentionDays: env.PHASE4_JOB_RUN_RETENTION_DAYS,
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
      "phase4:sync-active-locations",
      "phase4:send-email-notifications",
      "phase4:sync-future-releases",
      "phase4:cleanup-phase4-data",
    ],
  };
}

export async function enqueueLocationSync(input: {
  locationId: string;
  reason?: string;
  startDate?: string;
  numDays?: number;
}) {
  return getPhase4SyncQueue().add(
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

export async function enqueueNotificationProcessing(input?: {
  locationId?: string | null;
  reason?: string;
  limit?: number;
}) {
  return getPhase4NotificationQueue().add(
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

export async function enqueueLocationReplay(input: {
  locationId: string;
  startDate?: string;
  numDays?: number;
}) {
  return getPhase4SyncQueue().add(
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
  return getPhase4SyncQueue().add(
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
