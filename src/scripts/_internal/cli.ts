import { closePool } from "@/db/client";
import { closeAvailabilityQueues } from "@/modules/availability/queues";
import { closeRedis } from "@/shared/infra/redis";

export function getArg(name: string) {
  const args = process.argv.slice(2);
  const exact = `--${name}`;
  const prefixed = `--${name}=`;

  const prefixedArg = args.find((arg) => arg.startsWith(prefixed));
  if (prefixedArg) {
    return prefixedArg.slice(prefixed.length);
  }

  const exactIndex = args.findIndex((arg) => arg === exact);
  if (exactIndex >= 0 && args[exactIndex + 1]) {
    return args[exactIndex + 1];
  }

  return undefined;
}

export function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

export async function closeScriptRuntime() {
  await Promise.allSettled([closeAvailabilityQueues(), closeRedis(), closePool()]);
}

export async function runCli(main: () => Promise<void>, label: string) {
  try {
    await main();
  } catch (error) {
    console.error(`${label} failed:`, error);
    process.exitCode = 1;
  } finally {
    await closeScriptRuntime();
  }
}
