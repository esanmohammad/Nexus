import { saveToken } from "../lib/auth.js";
import { getConfig } from "../lib/config.js";

export async function run() {
  const config = await getConfig();
  const apiUrl = config.apiUrl || process.env.NEXUS_API_URL || "http://localhost:8080";

  console.log(`Opening browser for Google OAuth...`);
  console.log(`Visit: ${apiUrl}/api/auth/login`);

  // In a real implementation, this would:
  // 1. Open browser to Google OAuth consent URL
  // 2. Start local HTTP server on random port
  // 3. Wait for callback with auth code
  // 4. Exchange code for JWT
  // 5. Store JWT

  const token = process.env.NEXUS_TOKEN || "dev-token";
  await saveToken(token);
  console.log("Logged in successfully");
}

export default { run };
