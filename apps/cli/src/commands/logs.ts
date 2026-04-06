import { getToken } from "../lib/auth.js";
import { getConfig } from "../lib/config.js";

interface LogsFlags {
  version?: number;
}

function parseArgs(args: string[]): { name: string; flags: LogsFlags } {
  const name = args.find((a) => !a.startsWith("--")) || "";
  const flags: LogsFlags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--version" && args[i + 1]) flags.version = parseInt(args[++i]);
  }
  return { name, flags };
}

export async function run(args: string[]) {
  const { name, flags } = parseArgs(args);
  if (!name) {
    console.error("Usage: nexus logs <name> [--version N]");
    process.exit(1);
  }

  const token = await getToken();
  const config = await getConfig();
  const version = flags.version || "latest";

  console.log(`Build log for "${name}" v${version}:`);
  // In real implementation: fetch and stream build log
}

export default { run };
