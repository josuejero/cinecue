import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { movies } from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import {
  syncFutureReleasesPhaseOne,
  syncShowingsByZip,
  syncTheatresByZip,
} from "@/lib/phase1/sync";
import { NotFoundError } from "@/lib/phase2/errors";
import {
  refreshLocationReadModel,
  refreshMovieLocalStatusForLocation,
} from "@/lib/phase2/read-model";
import { isGracenoteRequestNotAuthorizedError } from "@/lib/providers/gracenote";
import { getLocationCluster, listActiveLocationClusters } from "./location-clusters";
import { writeErrorLog, writeLog } from "./logging";
import {
  cleanupOldShowtimeRows,
  cleanupOldWorkerJobRuns,
  touchLocationSyncState,
} from "./operations";
import {
  enqueueLocationSync,
  enqueueNotificationProcessing,
  enqueuePushNotificationProcessing,
} from "./queues";

function todayBusinessDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function enqueueActiveLocationSyncs(limit?: number) {
  const env = getServerEnv();
  const clusters = await listActiveLocationClusters(limit ?? env.PHASE4_ACTIVE_LOCATION_LIMIT);

  for (const cluster of clusters) {
    await enqueueLocationSync({
      locationId: cluster.locationId,
      reason: "scheduled-fanout",
      numDays: env.PHASE4_SYNC_NUM_DAYS,
    });
  }

  return {
    scanned: clusters.length,
    enqueued: clusters.length,
    locationIds: clusters.map((cluster) => cluster.locationId),
  };
}

export async function runActiveLocationSyncsNow(limit?: number) {
  const env = getServerEnv();
  const clusters = await listActiveLocationClusters(limit ?? env.PHASE4_ACTIVE_LOCATION_LIMIT);
  const results = [];

  for (const cluster of clusters) {
    results.push(
      await syncLocationCluster({
        locationId: cluster.locationId,
        reason: "manual-batch",
        numDays: env.PHASE4_SYNC_NUM_DAYS,
      }),
    );
  }

  return {
    processed: results.length,
    results,
  };
}

export async function syncLocationCluster(input: {
  locationId: string;
  reason?: string;
  startDate?: string | null;
  numDays?: number | null;
}) {
  const env = getServerEnv();
  const cluster = await getLocationCluster(input.locationId);

  if (!cluster) {
    throw new NotFoundError("Location cluster not found.");
  }

  if (!cluster.postalCode) {
    throw new Error("Location cluster is missing a postal code.");
  }

  const startDate = input.startDate ?? todayBusinessDate();
  const numDays = input.numDays ?? env.PHASE4_SYNC_NUM_DAYS;

  let theatresSummary:
    | Awaited<ReturnType<typeof syncTheatresByZip>>
    | { skipped: true; reason: string; theatres: number };

  try {
    theatresSummary = await syncTheatresByZip({
      zip: cluster.postalCode,
      radiusMiles: cluster.radiusMiles,
    });
  } catch (error) {
    if (isGracenoteRequestNotAuthorizedError(error)) {
      theatresSummary = {
        skipped: true,
        reason: "gracenote_not_authorized",
        theatres: 0,
      };
    } else {
      throw error;
    }
  }

  const showingsSummary = await syncShowingsByZip({
    zip: cluster.postalCode,
    startDate,
    numDays,
    radiusMiles: cluster.radiusMiles,
  });

  const readModelSummary = await refreshLocationReadModel(cluster.locationId, {
    sourceSyncRunId: showingsSummary.syncRunId,
  });

  const now = new Date();

  await touchLocationSyncState({
    locationId: cluster.locationId,
    lastShowingsSyncRunId: showingsSummary.syncRunId,
    lastShowingsSyncAt: now,
    lastReadModelRefreshAt: now,
    lastSuccessfulSyncAt: now,
    staleAfterSeconds: env.PHASE4_STALE_AFTER_MINUTES * 60,
  });

  await enqueueNotificationProcessing({
    locationId: cluster.locationId,
    reason: `after-location-sync:${cluster.locationId}`,
    limit: env.PHASE4_NOTIFICATION_BATCH_SIZE,
  });

  await enqueuePushNotificationProcessing({
    locationId: cluster.locationId,
    reason: `after-location-sync:${cluster.locationId}`,
    limit: env.PHASE5_PUSH_BATCH_SIZE,
  });

  await touchLocationSyncState({
    locationId: cluster.locationId,
    lastNotificationEnqueueAt: new Date(),
    staleAfterSeconds: env.PHASE4_STALE_AFTER_MINUTES * 60,
  });

  writeLog("info", "phase4.location_sync.completed", {
    locationId: cluster.locationId,
    reason: input.reason ?? "manual",
    startDate,
    numDays,
    showingsSyncRunId: showingsSummary.syncRunId,
  });

  return {
    locationId: cluster.locationId,
    normalizedKey: cluster.normalizedKey,
    postalCode: cluster.postalCode,
    reason: input.reason ?? "manual",
    startDate,
    numDays,
    theatres: theatresSummary,
    showings: showingsSummary,
    readModel: readModelSummary,
  };
}

export async function syncFutureReleaseCatalog(input?: {
  releaseDate?: string;
  numDays?: number;
  country?: "USA" | "CAN";
}) {
  const env = getServerEnv();
  const releaseDate = input?.releaseDate ?? todayBusinessDate();

  try {
    const summary = await syncFutureReleasesPhaseOne({
      releaseDate,
      numDays: input?.numDays ?? env.PHASE4_FUTURE_RELEASES_NUM_DAYS,
      country: input?.country ?? env.PHASE4_SYNC_COUNTRY,
    });

    return summary;
  } catch (error) {
    if (isGracenoteRequestNotAuthorizedError(error)) {
      writeErrorLog("phase4.future_releases.skipped", error, {
        releaseDate,
      });

      return {
        syncRunId: `skipped:future-releases:${releaseDate}`,
        processed: 0,
        created: 0,
        updated: 0,
        conflicts: 0,
        skipped: true as const,
        reason: "gracenote_not_authorized",
      };
    }

    throw error;
  }
}

export async function replayLocationNow(input: {
  locationId: string;
  startDate?: string | null;
  numDays?: number | null;
}) {
  return syncLocationCluster({
    locationId: input.locationId,
    reason: "replay-location",
    startDate: input.startDate ?? todayBusinessDate(),
    numDays: input.numDays,
  });
}

export async function replayMovieNow(input: {
  locationId: string;
  movieId: string;
}) {
  const db = getDb();

  const [movie] = await db
    .select({ id: movies.id })
    .from(movies)
    .where(eq(movies.id, input.movieId))
    .limit(1);

  if (!movie) {
    throw new NotFoundError("Movie not found.");
  }

  const derived = await refreshMovieLocalStatusForLocation(input.locationId, input.movieId, {
    sourceSyncRunId: null,
  });

  return {
    locationId: input.locationId,
    movieId: input.movieId,
    derived,
  };
}

export async function runPhase4Cleanup(input?: {
  showtimeRetentionDays?: number;
  jobRunRetentionDays?: number;
}) {
  const env = getServerEnv();

  const [showtimesSummary, jobRunsSummary] = await Promise.all([
    cleanupOldShowtimeRows(input?.showtimeRetentionDays ?? env.PHASE4_SHOWTIME_RETENTION_DAYS),
    cleanupOldWorkerJobRuns(input?.jobRunRetentionDays ?? env.PHASE4_JOB_RUN_RETENTION_DAYS),
  ]);

  return {
    showtimes: showtimesSummary,
    workerJobRuns: jobRunsSummary,
  };
}
