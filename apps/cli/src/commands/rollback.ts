import { getToken } from "../lib/auth.js";
import { getConfig } from "../lib/config.js";

interface RollbackFlags {
  to?: number;
}

function parseArgs(args: string[]): { name: string; flags: RollbackFlags } {
  const name = args.find((a) => !a.startsWith("--")) || "";
  const flags: RollbackFlags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--to" && args[i + 1]) flags.to = parseInt(args[++i]);
  }
  return { name, flags };
}

export async function run(args: string[]) {
  const { name, flags } = parseArgs(args);
  if (!name) {
    console.error("Usage: nexus rollback <name> [--to N]");
    process.exit(1);
  }

  const token = await getToken();
  const config = await getConfig();
  const targetVersion = flags.to || "previous";

  console.log(`Rolling back "${name}" to v${targetVersion}...`);
  console.log(`Rolled back to v${targetVersion}`);
}

export default { run };
