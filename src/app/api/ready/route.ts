import { checkDb } from "@/db/client";
import { getServerEnv } from "@/lib/env";
import { getRedis } from "@/lib/redis";
import { NextResponse } from "next/server";

export async function GET() {
  const env = getServerEnv();

  const checks = {
    database: false,
    redis: false,
    authSecretConfigured: Boolean(env.AUTH_SECRET),
    gracenoteConfigured: Boolean(env.GRACENOTE_API_KEY),
    tmdbConfigured: Boolean(env.TMDB_API_KEY),
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

  const ok = checks.database && checks.redis;

  return NextResponse.json(
    {
      ok,
      phase: 0,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}