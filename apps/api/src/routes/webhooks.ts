import { Hono } from "hono";
import crypto from "crypto";
import { getWebhookSecret } from "../services/github.service.js";
import * as sandboxService from "../services/sandbox.service.js";

export const webhooksRoute = new Hono();

webhooksRoute.post("/github", async (c) => {
  const secret = getWebhookSecret();
  const body = await c.req.text();
  const signatureHeader = c.req.header("X-Hub-Signature-256") || "";

  // Verify HMAC signature
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(body).digest("hex");

  if (signatureHeader !== expected) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid signature" } }, 401);
  }

  const payload = JSON.parse(body);

  // Ignore non-main branch pushes
  if (payload.ref && payload.ref !== "refs/heads/main") {
    return c.json({ message: "Ignored non-main branch" }, 200);
  }

  // Find sandbox by github_repo
  const repoFullName = payload.repository?.full_name;
  if (!repoFullName) {
    return c.json({ message: "No repository in payload" }, 200);
  }

  const allSandboxes = sandboxService.listAll();
  const sandbox = allSandboxes.find(
    (s: any) => s.github_repo === repoFullName
  );

  if (!sandbox) {
    return c.json({ error: { code: "NOT_FOUND", message: "No sandbox connected to this repo" } }, 404);
  }

  // Create auto-deploy version label
  const sha = payload.after || "";
  const shortSha = sha.substring(0, 7);
  const _label = `Auto-deploy from main (${shortSha})`;

  // Update sandbox version
  const newVersion = (sandbox.current_version || 0) + 1;
  await sandboxService.update(sandbox.id, { current_version: newVersion });

  return c.json({ message: "Deploy triggered", version: newVersion }, 200);
});
