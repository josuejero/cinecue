import { Queue } from "bullmq";
import { enqueueActiveLocationSyncs } from "@/modules/availability/jobs";
import {
  enqueueEmailNotificationProcessing,
  enqueuePushDeliveryProcessing,
  upsertWorkerSchedulers,
} from "@/modules/availability/queues";
import { getServerEnv } from "@/shared/infra/env";
import { getBullmqConnection, getRedis } from "@/shared/infra/redis";

function legacyRuntimeLabel(value: number) {
  return `phase${value}`;
}

function getLegacyQueueDefinitions() {
  return [
    {
      queueName: `${legacyRuntimeLabel(1)}-provider-sync`,
      schedulerIds: [] as string[],
    },
    {
      queueName: `${legacyRuntimeLabel(4)}-sync`,
      schedulerIds: [
        `${legacyRuntimeLabel(4)}:sync-active-locations`,
        `${legacyRuntimeLabel(4)}:sync-future-releases`,
        `${legacyRuntimeLabel(4)}:cleanup-${legacyRuntimeLabel(4)}-data`,
      ],
    },
    {
      queueName: `${legacyRuntimeLabel(4)}-notifications`,
      schedulerIds: [
        `${legacyRuntimeLabel(4)}:send-email-notifications`,
        `${legacyRuntimeLabel(5)}:send-push-notifications`,
      ],
    },
  ];
}

export function getLegacyDashboardCachePrefix() {
  return `${legacyRuntimeLabel(6)}:dashboard-cache:`;
}

async function scanKeys(pattern: string) {
  const redis = getRedis();
  const keys = new Set<string>();
  let cursor = "0";

  do {
    const [nextCursor, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 500);
    cursor = nextCursor;

    for (const key of batch) {
      keys.add(key);
    }
  } while (cursor !== "0");

  return Array.from(keys).sort();
}

async function deleteKeys(keys: string[]) {
  const redis = getRedis();
  let deleted = 0;

  for (let index = 0; index < keys.length; index += 500) {
    const chunk = keys.slice(index, index + 500);
    if (chunk.length === 0) {
      continue;
    }

    deleted += await redis.del(...chunk);
  }

  return deleted;
}

export async function runRuntimeIdCutover(input?: { dryRun?: boolean }) {
  const dryRun = input?.dryRun ?? false;
  const env = getServerEnv();
  const legacyQueues = getLegacyQueueDefinitions().map((definition) => ({
    ...definition,
    queue: new Queue(definition.queueName, {
      connection: getBullmqConnection(),
    }),
  }));

  try {
    const legacyCacheKeys = await scanKeys(`${getLegacyDashboardCachePrefix()}*`);
    const legacyQueueSummaries = [];

    for (const legacyQueue of legacyQueues) {
      const [jobCounts, schedulers] = await Promise.all([
        legacyQueue.queue.getJobCounts(
          "active",
          "completed",
          "delayed",
          "failed",
          "prioritized",
          "waiting",
        ),
        legacyQueue.queue.getJobSchedulers(),
      ]);

      const presentSchedulerIds = schedulers
        .map((scheduler) => scheduler.id ?? scheduler.key)
        .filter((id): id is string => Boolean(id))
        .filter((id) => legacyQueue.schedulerIds.includes(id))
        .sort();

      const removedSchedulers: Array<{ id: string; removed: boolean }> = [];

      if (!dryRun) {
        for (const schedulerId of legacyQueue.schedulerIds) {
          removedSchedulers.push({
            id: schedulerId,
            removed: await legacyQueue.queue.removeJobScheduler(schedulerId),
          });
        }

        await legacyQueue.queue.drain(true);
      }

      legacyQueueSummaries.push({
        queueName: legacyQueue.queueName,
        jobCounts,
        presentSchedulerIds,
        removedSchedulers,
        drained: !dryRun,
      });
    }

    if (dryRun) {
      return {
        dryRun: true,
        legacyQueues: legacyQueueSummaries,
        dashboardCache: {
          prefix: getLegacyDashboardCachePrefix(),
          keysMatched: legacyCacheKeys.length,
          sample: legacyCacheKeys.slice(0, 25),
        },
      };
    }

    const schedulerSummary = await upsertWorkerSchedulers();
    const [deletedCacheKeys, activeLocationSyncs, emailJob, pushJob] = await Promise.all([
      deleteKeys(legacyCacheKeys),
      enqueueActiveLocationSyncs(),
      enqueueEmailNotificationProcessing({
        reason: "cutover-runtime-ids",
        limit: env.NOTIFICATIONS_EMAIL_BATCH_SIZE,
      }),
      enqueuePushDeliveryProcessing({
        reason: "cutover-runtime-ids",
        limit: env.NOTIFICATIONS_PUSH_BATCH_SIZE,
      }),
    ]);

    return {
      dryRun: false,
      legacyQueues: legacyQueueSummaries,
      dashboardCache: {
        prefix: getLegacyDashboardCachePrefix(),
        keysMatched: legacyCacheKeys.length,
        deletedKeys: deletedCacheKeys,
      },
      currentRuntime: {
        schedulers: schedulerSummary,
        reenqueue: {
          activeLocationSyncs,
          email: {
            id: emailJob.id,
            name: emailJob.name,
            queueName: emailJob.queueName,
          },
          push: {
            id: pushJob.id,
            name: pushJob.name,
            queueName: pushJob.queueName,
          },
        },
      },
    };
  } finally {
    await Promise.allSettled(legacyQueues.map(({ queue }) => queue.close()));
  }
}
