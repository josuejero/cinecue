import { getServerEnv } from "@/shared/infra/env";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  var __cinecuePool: Pool | undefined;
}

export function getPool() {
  const env = getServerEnv();

  if (!global.__cinecuePool) {
    global.__cinecuePool = new Pool({
      connectionString: env.DATABASE_URL,
    });
  }

  return global.__cinecuePool;
}

export async function closePool() {
  if (!global.__cinecuePool) {
    return;
  }

  await global.__cinecuePool.end();
  global.__cinecuePool = undefined;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export async function checkDb() {
  await getDb().execute(sql`select 1`);
}
