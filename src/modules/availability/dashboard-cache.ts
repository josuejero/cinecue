import { getServerEnv } from "@/shared/infra/env";
import { getRedis } from "@/shared/infra/redis";

function userTagKey(userId: string) {
  return `dashboard-cache:user:${userId}`;
}

function scopedKey(userId: string, scope: string) {
  return `${userTagKey(userId)}:${scope}`;
}

export async function readDashboardCache<T>(userId: string, scope: string) {
  const redis = getRedis();
  const raw = await redis.get(scopedKey(userId, scope));

  if (!raw) {
    return null as T | null;
  }

  return JSON.parse(raw) as T;
}

export async function writeDashboardCache<T>(
  userId: string,
  scope: string,
  payload: T,
) {
  const redis = getRedis();
  const env = getServerEnv();
  const tagKey = userTagKey(userId);
  const key = scopedKey(userId, scope);

  await redis
    .multi()
    .set(key, JSON.stringify(payload), "EX", env.DASHBOARD_CACHE_TTL_SECONDS)
    .sadd(tagKey, key)
    .expire(tagKey, env.DASHBOARD_CACHE_TTL_SECONDS)
    .exec();
}

export async function invalidateDashboardCacheForUser(userId: string) {
  const redis = getRedis();
  const tagKey = userTagKey(userId);
  const keys = await redis.smembers(tagKey);

  if (!keys.length) {
    await redis.del(tagKey);
    return 0;
  }

  await redis.del(tagKey, ...keys);
  return keys.length;
}
