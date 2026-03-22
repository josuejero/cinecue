import { NextResponse } from "next/server";
import { checkDb } from "@/db/client";
import { getServerEnv } from "@/lib/env";
import { getPhase4OperationalSnapshot } from "@/lib/phase4/operations";
import { isEmailTransportConfigured } from "@/lib/phase3/notifications";
import { getRedis } from "@/lib/redis";

export async function GET() {
  const env = getServerEnv();

  const checks = {
    database: false,
    redis: false,
    authSecretConfigured: Boolean(env.AUTH_SECRET),
    gracenoteConfigured: Boolean(env.GRACENOTE_API_KEY),
    tmdbConfigured: Boolean(env.TMDB_READ_ACCESS_TOKEN || env.TMDB_API_KEY),
    smtpConfigured: isEmailTransportConfigured(),
    schedulersEnabled: env.PHASE4_ENABLE_SCHEDULERS !== "false",
    staleLocationsUnderThreshold: true,
    staleLocationCount: 0,
  };

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
    const ops = await getPhase4OperationalSnapshot();
    checks.staleLocationCount = ops.staleLocationCount;
    checks.staleLocationsUnderThreshold = ops.staleLocationCount === 0;
  } catch (error) {
    console.error("Phase 4 ops readiness check failed:", error);
    checks.staleLocationsUnderThreshold = false;
  }

  const ok =
    checks.database &&
    checks.redis &&
    checks.staleLocationsUnderThreshold;

  return NextResponse.json(
    {
      ok,
      phase: 4,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
