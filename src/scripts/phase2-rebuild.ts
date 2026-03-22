import { getDb } from "@/db/client";
import { locations } from "@/db/schema";
import { normalizePostalCode } from "@/lib/normalize";
import { refreshLocationReadModel } from "@/lib/phase2/read-model";
import { eq } from "drizzle-orm";

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
  const db = getDb();
  const all = process.argv.includes("--all");
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

main().catch((error) => {
  console.error("Phase 2 read-model rebuild failed:", error);
  process.exit(1);
});