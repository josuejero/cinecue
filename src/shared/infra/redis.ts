import IORedis from "ioredis";
import { getServerEnv } from "./env";

declare global {
  var __cinecueRedis: IORedis | undefined;
}

export function getRedis() {
  const env = getServerEnv();

  if (!global.__cinecueRedis) {
    global.__cinecueRedis = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }

  return global.__cinecueRedis;
}

export async function closeRedis() {
  if (!global.__cinecueRedis) {
    return;
  }

  await global.__cinecueRedis.quit();
  global.__cinecueRedis = undefined;
}

export function getBullmqConnection() {
  const env = getServerEnv();

  return {
    url: env.REDIS_URL,
    maxRetriesPerRequest: null as null,
  };
}
