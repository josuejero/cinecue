import { NextResponse } from "next/server";
import { checkDb } from "@/db/client";
import { getServerEnv } from "@/lib/env";
import { isEmailTransportConfigured } from "@/lib/phase3/notifications";
import { isPushConfigured } from "@/lib/phase5/push";
import { getPhase6OperationalSnapshot } from "@/lib/phase6/ops";
import { getRedis } from "@/lib/redis";

function hasConfiguredValue(value: string | undefined | null) {
  const trimmed = value?.trim();
  return Boolean(trimmed && !trimmed.startsWith("REPLACE_WITH_"));
}

export async function GET() {
  const env = getServerEnv();

  const checks = {
    database: false,
    redis: false,
    authSecretConfigured: hasConfiguredValue(env.AUTH_SECRET),
    gracenoteConfigured: hasConfiguredValue(env.GRACENOTE_API_KEY),
    tmdbConfigured:
      hasConfiguredValue(env.TMDB_READ_ACCESS_TOKEN) || hasConfiguredValue(env.TMDB_API_KEY),
    smtpConfigured: isEmailTransportConfigured(),
    pushConfigured: isPushConfigured(),
    schedulersEnabled: env.PHASE4_ENABLE_SCHEDULERS !== "false",
    staleLocationsUnderThreshold: true,
    staleLocationCount: 0,
  };

  let operations: Awaited<ReturnType<typeof getPhase6OperationalSnapshot>> | null = null;

  try {
    await checkDb();
    checks.database = true;
  } catch (error) {
    console.error("Database readiness check failed:", error);
  }

  try {
    const redis = getRedis();
    checks.redis = (await redis.ping()) === "PONG";
  } catch (error) {
    console.error("Redis readiness check failed:", error);
  }

  try {
    operations = await getPhase6OperationalSnapshot();
    checks.staleLocationCount = operations.performance.staleLocationCount;
    checks.staleLocationsUnderThreshold = operations.performance.staleLocationCount === 0;
  } catch (error) {
    console.error("Phase 6 ops readiness check failed:", error);
    checks.staleLocationsUnderThreshold = false;
  }

  const ok =
    checks.database &&
    checks.redis &&
    checks.authSecretConfigured &&
    checks.staleLocationsUnderThreshold;

  return NextResponse.json(
    {
      ok,
      phase: 6,
      checks,
      operations,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
