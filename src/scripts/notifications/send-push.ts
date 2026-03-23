import { processPendingPushNotifications } from "@/modules/notifications/push";
import { getArg, hasFlag, runCli } from "@/scripts/_internal/cli";

async function main() {
  const dryRun = hasFlag("dry-run");
  const limit = Number(getArg("limit") ?? 100);
  const daysBack = Number(getArg("days-back") ?? 7);
  const locationId = getArg("location-id") ?? null;

  const summary = await processPendingPushNotifications({
    dryRun,
    limit,
    daysBack,
    locationId,
  });

  console.log(JSON.stringify(summary, null, 2));
}

void runCli(main, "Push notification delivery");
