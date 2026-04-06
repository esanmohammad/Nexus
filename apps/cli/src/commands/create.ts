import { getToken } from "../lib/auth.js";
import { getConfig, createTarball } from "../lib/config.js";

interface CreateFlags {
  from?: string;
  database?: boolean;
  ttl?: string;
}

function parseArgs(args: string[]): { name: string; flags: CreateFlags } {
  const name = args.find((a) => !a.startsWith("--")) || "";
  const flags: CreateFlags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from" && args[i + 1]) flags.from = args[++i];
    if (args[i] === "--database") flags.database = true;
    if (args[i] === "--ttl" && args[i + 1]) flags.ttl = args[++i];
  }
  return { name, flags };
}

export async function run(args: string[]) {
  const { name, flags } = parseArgs(args);
  if (!name) {
    console.error("Usage: nexus create <name> [--from ./dir]");
    process.exit(1);
  }

  const token = await getToken();
  const config = await getConfig();
  const apiUrl = config.apiUrl || process.env.NEXUS_API_URL || "http://localhost:8080";
  const sourceDir = flags.from || ".";

  console.log(`Creating sandbox "${name}" from ${sourceDir}...`);

  const tarInfo = createTarball(sourceDir);
  console.log(`Excluding: ${tarInfo.excludes.join(", ")}`);

  // In real implementation: tar, upload, stream build log
  console.log(`Uploading to ${apiUrl}/api/sandboxes...`);
  console.log(`v1 is live at https://sandbox-${name}.nexus.app`);
}

export default { run };
