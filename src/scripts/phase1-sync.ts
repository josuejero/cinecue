import { getServerEnv } from "@/lib/env";
import { syncZipPhaseOne } from "@/lib/phase1/sync";

function getArg(name: string) {
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

async function main() {
  const env = getServerEnv();

  const zip = getArg("zip") ?? env.PHASE1_TEST_ZIP;
  if (!zip) {
    throw new Error("Provide --zip or set PHASE1_TEST_ZIP in .env.");
  }

  const startDate = getArg("start-date") ?? new Date().toISOString().slice(0, 10);
  const numDays = Number(getArg("num-days") ?? 7);
  const radiusMiles = Number(getArg("radius-miles") ?? 25);
  const country = (getArg("country") as "USA" | "CAN" | undefined) ?? "USA";

  const summary = await syncZipPhaseOne({
    zip,
    startDate,
    numDays,
    radiusMiles,
    country,
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Phase 1 sync failed:", error);
  process.exit(1);
});