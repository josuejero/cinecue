import { syncAvailabilityByZip } from "@/modules/availability/ingestion/sync";
import { getServerEnv } from "@/shared/infra/env";
import { getArg, runCli } from "@/scripts/_internal/cli";

async function main() {
  const env = getServerEnv();

  const zip = getArg("zip") ?? env.AVAILABILITY_TEST_ZIP;
  if (!zip) {
    throw new Error("Provide --zip or set AVAILABILITY_TEST_ZIP in .env.");
  }

  const startDate = getArg("start-date") ?? new Date().toISOString().slice(0, 10);
  const numDays = Number(getArg("num-days") ?? 7);
  const radiusMiles = Number(getArg("radius-miles") ?? 25);
  const country = (getArg("country") as "USA" | "CAN" | undefined) ?? "USA";

  const summary = await syncAvailabilityByZip({
    zip,
    startDate,
    numDays,
    radiusMiles,
    country,
  });

  console.log(JSON.stringify(summary, null, 2));
}

void runCli(main, "Availability sync");
