import { getToken } from "../lib/auth.js";
import { getConfig } from "../lib/config.js";

interface ListFlags {
  json?: boolean;
}

function parseArgs(args: string[]): { flags: ListFlags } {
  const flags: ListFlags = {};
  if (args.includes("--json")) flags.json = true;
  return { flags };
}

export async function run(args: string[]) {
  const { flags } = parseArgs(args);
  const token = await getToken();
  const config = await getConfig();
  const apiUrl = config.apiUrl || process.env.NEXUS_API_URL || "http://localhost:8080";

  // In real implementation: fetch and display sandboxes
  if (flags.json) {
    console.log(JSON.stringify([]));
  } else {
    console.log("Name          State     Version  URL                              Expires");
    console.log("────          ─────     ───────  ───                              ───────");
    console.log("No sandboxes found");
  }
}

export default { run };
