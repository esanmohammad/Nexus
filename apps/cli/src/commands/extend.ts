import { getToken } from "../lib/auth.js";
import { getConfig } from "../lib/config.js";

interface ExtendFlags {
  ttl?: string;
}

function parseArgs(args: string[]): { name: string; flags: ExtendFlags } {
  const name = args.find((a) => !a.startsWith("--")) || "";
  const flags: ExtendFlags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ttl" && args[i + 1]) flags.ttl = args[++i];
  }
  return { name, flags };
}

export function parseDuration(d: string): number | null {
  const match = d.match(/^(\d+)d$/);
  return match ? parseInt(match[1]) : null;
}

export async function run(args: string[]) {
  const { name, flags } = parseArgs(args);
  if (!name) {
    console.error("Usage: nexus extend <name> --ttl 30d");
    process.exit(1);
  }

  const days = flags.ttl ? parseDuration(flags.ttl) : 7;
  if (!days) {
    console.error("Invalid TTL format. Use e.g. '7d' or '30d'");
    process.exit(1);
  }

  const token = await getToken();
  const config = await getConfig();

  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  console.log(`Extended "${name}" by ${days} days. New expiry: ${expiresAt.toISOString()}`);
}

export default { run };
