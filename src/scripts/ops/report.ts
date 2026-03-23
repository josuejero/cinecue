import { getOperationalSnapshot } from "@/modules/ops/server";
import { runCli } from "@/scripts/_internal/cli";

async function main() {
  const snapshot = await getOperationalSnapshot();
  console.log(JSON.stringify(snapshot, null, 2));
}

void runCli(main, "Operations report");
