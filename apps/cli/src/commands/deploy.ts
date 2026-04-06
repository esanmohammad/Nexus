import { getToken } from "../lib/auth.js";
import { getConfig, createTarball } from "../lib/config.js";

interface DeployFlags {
  label?: string;
}

function parseArgs(args: string[]): { name: string; flags: DeployFlags } {
  const name = args.find((a) => !a.startsWith("--")) || "";
  const flags: DeployFlags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--label" && args[i + 1]) flags.label = args[++i];
  }
  return { name, flags };
}

export async function run(args: string[]) {
  const { name, flags } = parseArgs(args);
  if (!name) {
    console.error("Usage: nexus deploy <name> [--label 'description']");
    process.exit(1);
  }

  const token = await getToken();
  const config = await getConfig();
  const apiUrl = config.apiUrl || process.env.NEXUS_API_URL || "http://localhost:8080";

  console.log(`Deploying new version to "${name}"...`);

  const tarInfo = createTarball(".");
  console.log(`Uploading to ${apiUrl}/api/sandboxes/${name}/versions...`);

  if (flags.label) {
    console.log(`Label: ${flags.label}`);
  }

  console.log(`v2 is live at https://sandbox-${name}.nexus.app`);
}

export default { run };
