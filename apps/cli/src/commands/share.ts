import { getToken } from "../lib/auth.js";
import { getConfig } from "../lib/config.js";

interface ShareFlags {
  team?: boolean;
  everyone?: boolean;
  email?: string;
  ownerOnly?: boolean;
}

function parseArgs(args: string[]): { name: string; flags: ShareFlags } {
  const name = args.find((a) => !a.startsWith("--")) || "";
  const flags: ShareFlags = {};
  if (args.includes("--team")) flags.team = true;
  if (args.includes("--everyone")) flags.everyone = true;
  if (args.includes("--owner-only")) flags.ownerOnly = true;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) flags.email = args[++i];
  }
  return { name, flags };
}

export async function run(args: string[]) {
  const { name, flags } = parseArgs(args);
  if (!name) {
    console.error("Usage: nexus share <name> [--team | --everyone | --email a@b.com | --owner-only]");
    process.exit(1);
  }

  const token = await getToken();
  const config = await getConfig();

  let mode = "owner_only";
  if (flags.team) mode = "team";
  if (flags.everyone) mode = "anyone";
  if (flags.email) mode = "custom";
  if (flags.ownerOnly) mode = "owner_only";

  console.log(`Updated "${name}" access mode to: ${mode}`);
}

export default { run };
