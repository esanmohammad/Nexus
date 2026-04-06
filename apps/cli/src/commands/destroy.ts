import { getToken } from "../lib/auth.js";
import { getConfig } from "../lib/config.js";

interface DestroyFlags {
  confirm?: boolean;
}

function parseArgs(args: string[]): { name: string; flags: DestroyFlags } {
  const name = args.find((a) => !a.startsWith("--")) || "";
  const flags: DestroyFlags = {};
  if (args.includes("--confirm")) flags.confirm = true;
  return { name, flags };
}

export async function run(args: string[]) {
  const { name, flags } = parseArgs(args);
  if (!name) {
    console.error("Usage: nexus destroy <name> [--confirm]");
    process.exit(1);
  }

  if (!flags.confirm) {
    console.log(`Type '${name}' to confirm destruction:`);
    // In real implementation: read stdin for confirmation
    return;
  }

  const token = await getToken();
  const config = await getConfig();

  console.log(`Destroyed ${name}`);
}

export default { run };
