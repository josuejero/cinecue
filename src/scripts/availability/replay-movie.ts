import { replayMovieNow } from "@/modules/availability/jobs";
import { runTrackedWorkerJob } from "@/modules/ops/worker-runtime";
import { getArg, runCli } from "@/scripts/_internal/cli";

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

void runCli(main, "Movie replay");
