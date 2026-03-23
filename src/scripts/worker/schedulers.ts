import { upsertWorkerSchedulers } from "@/modules/availability/queues";
import { runCli } from "@/scripts/_internal/cli";

async function main() {
  const summary = await upsertWorkerSchedulers();
  console.log(JSON.stringify(summary, null, 2));
}

void runCli(main, "Worker scheduler bootstrap");
