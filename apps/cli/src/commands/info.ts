import { getToken } from "../lib/auth.js";
import { getConfig } from "../lib/config.js";

export async function run(args: string[]) {
  const name = args.find((a) => !a.startsWith("--")) || "";
  if (!name) {
    console.error("Usage: nexus info <name>");
    process.exit(1);
  }

  const token = await getToken();
  const config = await getConfig();
  const apiUrl = config.apiUrl || process.env.NEXUS_API_URL || "http://localhost:8080";

  // In real implementation: fetch sandbox details and versions
  console.log(`Sandbox: ${name}`);
  console.log(`State: running`);
  console.log(`URL: https://sandbox-${name}.nexus.app`);
  console.log(`Owner: user@co.com`);
  console.log(`TTL: 7 days`);
  console.log(`Access: owner_only`);
}

export default { run };
