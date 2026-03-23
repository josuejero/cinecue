import { runRuntimeIdCutover } from "@/modules/ops/cutover";
import { hasFlag, runCli } from "@/scripts/_internal/cli";

async function main() {
  const summary = await runRuntimeIdCutover({
    dryRun: hasFlag("dry-run"),
  });

  console.log(JSON.stringify(summary, null, 2));
}

void runCli(main, "Runtime id cutover");
