import { runTrackedWorkerJob } from "@/lib/phase4/operations";
import { replayMovieNow } from "@/lib/phase4/sync";

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
  const locationId = getArg("location-id");
  const movieId = getArg("movie-id");

  if (!locationId) {
    throw new Error("Provide --location-id.");
  }

  if (!movieId) {
    throw new Error("Provide --movie-id.");
  }

  const summary = await runTrackedWorkerJob(
    {
      queueName: "manual",
      jobName: "replay-movie",
      locationId,
      payload: { locationId, movieId },
      attempt: 1,
    },
    async () =>
      replayMovieNow({
        locationId,
        movieId,
      }),
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Phase 4 movie replay failed:", error);
  process.exit(1);
});
