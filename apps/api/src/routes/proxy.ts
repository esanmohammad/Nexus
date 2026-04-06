import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import * as sandboxService from "../services/sandbox.service.js";
import { getServiceUrl } from "../services/cloudrun.service.js";
import { GoogleAuth } from "google-auth-library";

export const proxyRoute = new Hono();

let _auth: GoogleAuth | null = null;
function getAuth(): GoogleAuth {
  if (!_auth) _auth = new GoogleAuth();
  return _auth;
}

// In production with Cloudflare Access, proxy is disabled (use CF tunnel instead)
proxyRoute.use("*", async (c, next) => {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.CLOUDFLARE_API_TOKEN
  ) {
    return c.json(
      { error: { code: "GONE", message: "Proxy disabled in production. Use Cloudflare tunnel." } },
      410
    );
  }
  return next();
});

proxyRoute.use("*", authMiddleware);

proxyRoute.all("/:sandboxName{.*}", async (c) => {
  const user = c.get("user");
  const rawParam = c.req.param("sandboxName");
  // Extract just the sandbox name (first path segment, strip trailing path/slash)
  const sandboxName = rawParam.split("/")[0];

  // Find sandbox by name — first check user's own sandboxes, then all sandboxes
  const sandboxes = await sandboxService.list(user.email);
  let sandbox = sandboxes.find((s) => s.name === sandboxName);

  // If not found in user's sandboxes, check all sandboxes (for shared/team access)
  if (!sandbox) {
    const allSandboxes = sandboxService.listAll();
    sandbox = allSandboxes.find((s) => s.name === sandboxName) || undefined;
  }

  if (!sandbox) {
    return c.json(
      { error: { code: "NOT_FOUND", message: `Sandbox "${sandboxName}" not found` } },
      404
    );
  }

  // Check access
  if (
    sandbox.owner_email !== user.email &&
    sandbox.access_mode === "owner_only"
  ) {
    return c.json(
      { error: { code: "FORBIDDEN", message: "Access denied" } },
      403
    );
  }

  // Handle sleeping sandbox
  if (sandbox.state === "sleeping") {
    return c.html(`<!DOCTYPE html>
<html>
<head><title>Sandbox expired</title></head>
<body>
  <h1>This sandbox has expired</h1>
  <p>Your sandbox "${sandbox.name}" is currently sleeping because it has expired.</p>
  <ul>
    <li><a href="/api/sandboxes/${sandbox.id}/wake">wake</a> - Wake up this sandbox</li>
    <li><a href="/api/sandboxes/${sandbox.id}/versions/1/source">download</a> - Download source code</li>
  </ul>
</body>
</html>`);
  }

  // Get Cloud Run URL
  const targetUrl = sandbox.cloud_run_url;
  if (!targetUrl) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Sandbox not deployed" } },
      404
    );
  }

  try {
    // Get identity token for Cloud Run
    const client = await getAuth().getIdTokenClient(targetUrl);
    const headers = await client.getRequestHeaders();

    // Proxy the request
    const url = new URL(c.req.path.replace(`/api/proxy/${sandboxName}`, ""), targetUrl);
    const response = await fetch(url.toString(), {
      method: c.req.method,
      headers: {
        ...headers,
        ...(c.req.header("content-type")
          ? { "Content-Type": c.req.header("content-type")! }
          : {}),
      },
      body: ["GET", "HEAD"].includes(c.req.method)
        ? undefined
        : await c.req.arrayBuffer(),
    });

    // Stream response back
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return c.json(
      { error: { code: "PROXY_ERROR", message: "Failed to proxy request" } },
      502
    );
  }
});
