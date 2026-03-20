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