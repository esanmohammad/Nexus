import { Hono } from "hono";
import {
  CreateSandboxSchema,
  UpdateSandboxSchema,
  ExtendSandboxSchema,
  ShareSandboxSchema,
} from "@nexus/shared";
import { authMiddleware } from "../middleware/auth.js";
import * as sandboxService from "../services/sandbox.service.js";

export const sandboxesRoute = new Hono();

// All routes require auth
sandboxesRoute.use("*", authMiddleware);

// POST /api/sandboxes - Create (multipart or JSON)
sandboxesRoute.post("/", async (c) => {
  const user = c.get("user");
  const contentType = c.req.header("content-type") || "";

  let config: any;
  let sourceBuffer: Buffer;

  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    const configStr = formData.get("config");
    const sourceFile = formData.get("source");

    if (!configStr) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: "Missing config in form data" } },
        400
      );
    }

    config = JSON.parse(typeof configStr === "string" ? configStr : await configStr.text());
    sourceBuffer = sourceFile
      ? Buffer.from(await (sourceFile as Blob).arrayBuffer())
      : Buffer.from("");
  } else {
    config = await c.req.json();
    sourceBuffer = Buffer.from("placeholder");
  }

  // Validate
  const parsed = CreateSandboxSchema.safeParse(config);
  if (!parsed.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.errors } },
      400
    );
  }

  try {
    const sandbox = await sandboxService.create({
      ...parsed.data,
      ownerEmail: user.email,
      sourceBuffer,
    });
    return c.json(sandbox, 201);
  } catch (err: any) {
    const status = err.status || 500;
    return c.json(
      { error: { code: status === 409 ? "CONFLICT" : status === 429 ? "QUOTA_EXCEEDED" : "ERROR", message: err.message } },
      status
    );
  }
});

// GET /api/sandboxes - List
sandboxesRoute.get("/", async (c) => {
  const user = c.get("user");
  const sandboxes = await sandboxService.list(user.email);
  return c.json({ sandboxes });
});

// GET /api/sandboxes/:id - Get
sandboxesRoute.get("/:id", async (c) => {
  const user = c.get("user");
  const sandbox = await sandboxService.get(c.req.param("id"));

  if (!sandbox) {
    return c.json({ error: { code: "NOT_FOUND", message: "Sandbox not found" } }, 404);
  }

  if (sandbox.owner_email !== user.email) {
    return c.json({ error: { code: "FORBIDDEN", message: "Access denied" } }, 403);
  }

  return c.json(sandbox);
});

// PATCH /api/sandboxes/:id - Update
sandboxesRoute.patch("/:id", async (c) => {
  const user = c.get("user");
  const sandbox = await sandboxService.get(c.req.param("id"));

  if (!sandbox) {
    return c.json({ error: { code: "NOT_FOUND", message: "Sandbox not found" } }, 404);
  }
  if (sandbox.owner_email !== user.email) {
    return c.json({ error: { code: "FORBIDDEN", message: "Access denied" } }, 403);
  }

  const body = await c.req.json();
  const parsed = UpdateSandboxSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.errors } },
      400
    );
  }

  const updated = await sandboxService.update(c.req.param("id"), parsed.data);
  return c.json(updated);
});

// DELETE /api/sandboxes/:id - Destroy
sandboxesRoute.delete("/:id", async (c) => {
  const user = c.get("user");
  const sandbox = await sandboxService.get(c.req.param("id"));

  if (!sandbox) {
    return c.json({ error: { code: "NOT_FOUND", message: "Sandbox not found" } }, 404);
  }
  if (sandbox.owner_email !== user.email) {
    return c.json({ error: { code: "FORBIDDEN", message: "Access denied" } }, 403);
  }

  await sandboxService.destroy(c.req.param("id"));
  return c.json({ message: "Sandbox destruction initiated" }, 202);
});

// POST /api/sandboxes/:id/extend
sandboxesRoute.post("/:id/extend", async (c) => {
  const user = c.get("user");
  const sandbox = await sandboxService.get(c.req.param("id"));

  if (!sandbox) {
    return c.json({ error: { code: "NOT_FOUND", message: "Sandbox not found" } }, 404);
  }
  if (sandbox.owner_email !== user.email) {
    return c.json({ error: { code: "FORBIDDEN", message: "Access denied" } }, 403);
  }

  const body = await c.req.json();
  const parsed = ExtendSandboxSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.errors } },
      400
    );
  }

  const updated = await sandboxService.extend(c.req.param("id"), parsed.data.ttl_days);
  return c.json(updated);
});

// POST /api/sandboxes/:id/share
sandboxesRoute.post("/:id/share", async (c) => {
  const user = c.get("user");
  const sandbox = await sandboxService.get(c.req.param("id"));

  if (!sandbox) {
    return c.json({ error: { code: "NOT_FOUND", message: "Sandbox not found" } }, 404);
  }
  if (sandbox.owner_email !== user.email) {
    return c.json({ error: { code: "FORBIDDEN", message: "Access denied" } }, 403);
  }

  const body = await c.req.json();
  const parsed = ShareSandboxSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.errors } },
      400
    );
  }

  const updated = await sandboxService.update(c.req.param("id"), {
    access_mode: parsed.data.access_mode,
    allowed_emails: parsed.data.allowed_emails,
  });
  return c.json(updated);
});
