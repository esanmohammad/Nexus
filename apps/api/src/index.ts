import { config } from "dotenv";
config({ path: new URL("../../../.env", import.meta.url).pathname });

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { healthRoute } from "./routes/health.js";
import { authRoute } from "./routes/auth.js";
import { sandboxesRoute } from "./routes/sandboxes.js";
import { versionsRoute } from "./routes/versions.js";
import { proxyRoute } from "./routes/proxy.js";
import { webhooksRoute } from "./routes/webhooks.js";
import { adminRoute } from "./routes/admin.js";
import { errorHandler } from "./middleware/error-handler.js";
import { auditLogMiddleware } from "./middleware/audit-log.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";

const app = new Hono();

// Security headers middleware — must be before all routes
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
});

// Body size limit middleware (100 MB)
const MAX_BODY_SIZE = 100 * 1024 * 1024;
app.use("*", async (c, next) => {
  const contentLength = c.req.header("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return c.json(
      { error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large" } },
      413
    );
  }
  // Also check actual body size for requests without content-length
  if (c.req.method === "POST" || c.req.method === "PUT" || c.req.method === "PATCH") {
    try {
      const body = await c.req.raw.clone().text();
      if (body.length > MAX_BODY_SIZE) {
        return c.json(
          { error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large" } },
          413
        );
      }
    } catch {
      // If we can't read the body, let it through
    }
  }
  return next();
});

// Rate limiting middleware
app.use("*", rateLimitMiddleware);

app.use("*", logger());
app.use("*", cors());

// Audit log middleware
app.use("*", auditLogMiddleware);

// Routes
app.route("/api/health", healthRoute);
app.route("/api/auth", authRoute);
app.route("/api/admin", adminRoute);
app.route("/api/sandboxes", sandboxesRoute);
app.route("/api/proxy", proxyRoute);
app.route("/api/webhooks", webhooksRoute);

// Version routes are nested under sandboxes
app.route("/api/sandboxes/:id/versions", versionsRoute);
app.route("/api/sandboxes/:id/rollback", new Hono().post("/", async (c) => {
  // Forward to versionsRoute rollback handler
  const { authMiddleware } = await import("./middleware/auth.js");
  const { RollbackSchema } = await import("@nexus/shared");
  const sandboxService = await import("./services/sandbox.service.js");

  // Auth check
  const authHeader = c.req.header("Authorization");
  const cookie = c.req.header("Cookie");

  if (!authHeader && !cookie) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }

  const { verifyToken } = await import("./middleware/auth.js");
  let user = null;
  if (authHeader?.startsWith("Bearer ")) {
    user = verifyToken(authHeader.slice(7));
  }
  if (!user && cookie) {
    const sessionMatch = cookie.match(/session=([^;]+)/);
    if (sessionMatch) {
      user = verifyToken(sessionMatch[1]);
    }
  }
  if (!user) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }

  const sandboxId = c.req.param("id") || "";
  const sandbox = await sandboxService.get(sandboxId);
  if (!sandbox) {
    return c.json({ error: { code: "NOT_FOUND", message: "Sandbox not found" } }, 404);
  }

  const body = await c.req.json();
  const parsed = RollbackSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, 400);
  }

  if (!sandbox.current_version || sandbox.current_version <= 1) {
    return c.json({ error: { code: "BAD_REQUEST", message: "No previous version" } }, 400);
  }

  const targetVersion = parsed.data.target_version || sandbox.current_version - 1;
  const updated = await sandboxService.update(sandbox.id, { current_version: targetVersion });
  return c.json(updated);
}));

// Internal cleanup endpoint
app.post("/api/internal/cleanup", async (c) => {
  // Auth check
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }

  const token = authHeader.slice(7);
  const { verifyToken } = await import("./middleware/auth.js");
  const user = verifyToken(token);
  if (!user) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }

  const { runCleanupCycle } = await import("./services/cleanup.service.js");
  const report = await runCleanupCycle();
  return c.json(report, 200);
});

// 404 handler for unknown API routes
app.notFound((c) => {
  return c.json(
    { error: { code: "NOT_FOUND", message: "Route not found" } },
    404
  );
});

// Global error handler
app.onError(errorHandler);

const port = Number(process.env.PORT) || 8080;

if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Nexus API running on http://localhost:${port}`);
  });
}

// Graceful shutdown handler
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

export default app;
