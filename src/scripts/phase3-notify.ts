import { processPendingEmailNotifications } from "@/lib/phase3/notifications";

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
  const dryRun = process.argv.includes("--dry-run");
  const limit = Number(getArg("limit") ?? 100);
  const daysBack = Number(getArg("days-back") ?? 14);
  const locationId = getArg("location-id") ?? null;

  const summary = await processPendingEmailNotifications({
    dryRun,
    limit,
    daysBack,
    locationId,
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Phase 3 notify failed:", error);
  process.exit(1);
});
