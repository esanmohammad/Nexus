import { getToken } from "../lib/auth.js";
import { getConfig } from "../lib/config.js";

interface VersionsFlags {
  json?: boolean;
}

function parseArgs(args: string[]): { name: string; flags: VersionsFlags } {
  const name = args.find((a) => !a.startsWith("--")) || "";
  const flags: VersionsFlags = {};
  if (args.includes("--json")) flags.json = true;
  return { name, flags };
}

export async function run(args: string[]) {
  const { name, flags } = parseArgs(args);
  if (!name) {
    console.error("Usage: nexus versions <name> [--json]");
    process.exit(1);
  }

  const token = await getToken();
  const config = await getConfig();

  if (flags.json) {
    console.log(JSON.stringify([]));
  } else {
    console.log("Version  Label       Status     Deployed By    Time");
    console.log("───────  ─────       ──────     ───────────    ────");
  }
}

export default { run };
