import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { locations } from "@/db/schema";
import { refreshLocationReadModel } from "@/modules/availability/read-model";
import { normalizePostalCode } from "@/modules/locations/normalize";
import { getArg, hasFlag, runCli } from "@/scripts/_internal/cli";

async function main() {
  const db = getDb();
  const all = hasFlag("all");
  const explicitLocationId = getArg("location-id");
  const zip = getArg("zip");
  const locationIds: string[] = [];

  if (all) {
    const rows = await db.select({ id: locations.id }).from(locations);
    locationIds.push(...rows.map((row) => row.id));
  } else if (explicitLocationId) {
    locationIds.push(explicitLocationId);
  } else if (zip) {
    const normalizedZip = normalizePostalCode(zip);
    if (!normalizedZip) {
      throw new Error("A valid ZIP or postal code is required.");
    }

    const [location] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.normalizedKey, `zip:${normalizedZip}`))
      .limit(1);

    if (!location) {
      throw new Error(`No location row exists yet for zip:${normalizedZip}.`);
    }

    locationIds.push(location.id);
  } else {
    throw new Error("Provide --all, --location-id, or --zip.");
  }

  const results = [];
  for (const locationId of locationIds) {
    results.push(await refreshLocationReadModel(locationId));
  }

  console.log(JSON.stringify({ results }, null, 2));
}

void runCli(main, "Availability read-model rebuild");
