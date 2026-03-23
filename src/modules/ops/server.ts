import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  notificationDeliveries,
  providerSyncRuns,
  workerJobRuns,
} from "@/db/schema";
import { getServerEnv } from "@/shared/infra/env";
import { getWorkerOperationalSnapshot } from "@/modules/ops/worker-runtime";
import { getGrowthMetrics } from "@/modules/analytics/server";

export async function getOperationalSnapshot() {
  const db = getDb();
  const env = getServerEnv();
  const [worker, growth] = await Promise.all([
    getWorkerOperationalSnapshot(),
    getGrowthMetrics(env.ANALYTICS_WINDOW_DAYS),
  ]);

  const [providerRow] = await db
    .select({
      totalSyncRuns7d: sql<number>`count(*)`,
      succeededSyncRuns7d: sql<number>`count(*) filter (where ${providerSyncRuns.status} = 'succeeded')`,
      failedSyncRuns7d: sql<number>`count(*) filter (where ${providerSyncRuns.status} = 'failed')`,
    })
    .from(providerSyncRuns)
    .where(sql`${providerSyncRuns.startedAt} >= now() - interval '7 days'`);

  const [workerRow] = await db
    .select({
      totalJobs7d: sql<number>`count(*)`,
      succeededJobs7d: sql<number>`count(*) filter (where ${workerJobRuns.status} = 'succeeded')`,
      failedJobs7d: sql<number>`count(*) filter (where ${workerJobRuns.status} = 'failed')`,
    })
    .from(workerJobRuns)
    .where(sql`${workerJobRuns.startedAt} >= now() - interval '7 days'`);

  const [deliveryRow] = await db
    .select({
      totalDeliveries30d: sql<number>`count(*)`,
      sent30d: sql<number>`count(*) filter (where ${notificationDeliveries.status} = 'sent')`,
      failed30d: sql<number>`count(*) filter (where ${notificationDeliveries.status} = 'failed')`,
      skipped30d: sql<number>`count(*) filter (where ${notificationDeliveries.status} = 'skipped')`,
    })
    .from(notificationDeliveries)
    .where(sql`${notificationDeliveries.createdAt} >= now() - interval '30 days'`);

  return {
    generatedAt: new Date().toISOString(),
    growth,
    performance: {
      staleLocationCount: worker.staleLocationCount,
      queues: worker.queues,
      recentFailures: worker.recentFailures,
    },
    providerHealth: {
      totalSyncRuns7d: Number(providerRow?.totalSyncRuns7d ?? 0),
      succeededSyncRuns7d: Number(providerRow?.succeededSyncRuns7d ?? 0),
      failedSyncRuns7d: Number(providerRow?.failedSyncRuns7d ?? 0),
    },
    workerHealth: {
      totalJobs7d: Number(workerRow?.totalJobs7d ?? 0),
      succeededJobs7d: Number(workerRow?.succeededJobs7d ?? 0),
      failedJobs7d: Number(workerRow?.failedJobs7d ?? 0),
    },
    costSignals: {
      notificationDeliveries30d: Number(deliveryRow?.totalDeliveries30d ?? 0),
      sent30d: Number(deliveryRow?.sent30d ?? 0),
      failed30d: Number(deliveryRow?.failed30d ?? 0),
      skipped30d: Number(deliveryRow?.skipped30d ?? 0),
      providerSyncRuns7d: Number(providerRow?.totalSyncRuns7d ?? 0),
    },
  };
}
