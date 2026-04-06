import { Hono } from "hono";
import { DeployVersionSchema, RollbackSchema } from "@nexus/shared";
import { authMiddleware } from "../middleware/auth.js";
import * as sandboxService from "../services/sandbox.service.js";
import * as versionService from "../services/version.service.js";

export const versionsRoute = new Hono();

versionsRoute.use("*", authMiddleware);

// POST /api/sandboxes/:id/versions - Deploy new version
versionsRoute.post("/", async (c) => {
  const user = c.get("user");
  const sandboxId = c.req.param("id") || c.req.query("sandboxId");

  const sandbox = await sandboxService.get(sandboxId || "");
  if (!sandbox) {
    return c.json({ error: { code: "NOT_FOUND", message: "Sandbox not found" } }, 404);
  }
  if (sandbox.owner_email !== user.email) {
    return c.json({ error: { code: "FORBIDDEN", message: "Access denied" } }, 403);
  }

  const contentType = c.req.header("content-type") || "";
  let config: any = {};

  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    const configStr = formData.get("config");
    if (configStr) {
      config = JSON.parse(typeof configStr === "string" ? configStr : await configStr.text());
    }
  } else {
    try {
      config = await c.req.json();
    } catch {
      config = {};
    }
  }

  const parsed = DeployVersionSchema.safeParse(config);
  if (!parsed.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.errors } },
      400
    );
  }

  // For now, return the sandbox with incremented version
  const newVersion = (sandbox.current_version || 1) + 1;
  const updated = await sandboxService.update(sandbox.id, {
    current_version: newVersion,
  });

  return c.json(updated, 201);
});

// GET /api/sandboxes/:id/versions - List versions
versionsRoute.get("/", async (c) => {
  const user = c.get("user");
  const sandboxId = c.req.param("id") || c.req.query("sandboxId");

  const sandbox = await sandboxService.get(sandboxId || "");
  if (!sandbox) {
    return c.json({ error: { code: "NOT_FOUND", message: "Sandbox not found" } }, 404);
  }

  return c.json({ versions: [] });
});

// GET /api/sandboxes/:id/versions/:num/source - Download source
versionsRoute.get("/:num/source", async (c) => {
  const sandboxId = c.req.param("id") || c.req.query("sandboxId");
  const num = parseInt(c.req.param("num") || "0", 10);

  const version = await versionService.get(sandboxId || "", num);
  if (!version) {
    return c.json({ error: { code: "NOT_FOUND", message: "Version not found" } }, 404);
  }

  const url = await versionService.getSourceDownloadUrl(version.id);
  return c.redirect(url, 302);
});

// POST /api/sandboxes/:id/rollback
versionsRoute.post("/rollback", async (c) => {
  const user = c.get("user");
  const sandboxId = c.req.param("id") || c.req.query("sandboxId");

  const sandbox = await sandboxService.get(sandboxId || "");
  if (!sandbox) {
    return c.json({ error: { code: "NOT_FOUND", message: "Sandbox not found" } }, 404);
  }
  if (sandbox.owner_email !== user.email) {
    return c.json({ error: { code: "FORBIDDEN", message: "Access denied" } }, 403);
  }

  const body = await c.req.json();
  const parsed = RollbackSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.errors } },
      400
    );
  }

  if (!sandbox.current_version || sandbox.current_version <= 1) {
    return c.json(
      { error: { code: "BAD_REQUEST", message: "No previous version to roll back to" } },
      400
    );
  }

  const targetVersion = parsed.data.target_version || sandbox.current_version - 1;
  const updated = await sandboxService.update(sandbox.id, {
    current_version: targetVersion,
  });

  return c.json(updated);
});
