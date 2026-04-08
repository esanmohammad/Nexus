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
  let sourceBuffer: Buffer | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    const configStr = formData.get("config");
    const sourceFile = formData.get("source");
    if (configStr) {
      config = JSON.parse(typeof configStr === "string" ? configStr : await configStr.text());
    }
    if (sourceFile && sourceFile instanceof Blob) {
      sourceBuffer = Buffer.from(await sourceFile.arrayBuffer());
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

  // If a github_url was provided and no source was uploaded, download the repo as a ZIP
  if (parsed.data.github_url && (!sourceBuffer || sourceBuffer.length === 0)) {
    try {
      const repoUrl = parsed.data.github_url.replace(/\.git$/, "");
      const archiveUrl = `${repoUrl}/archive/refs/heads/main.zip`;
      const response = await fetch(archiveUrl, { redirect: "follow" });
      if (!response.ok) {
        const masterUrl = `${repoUrl}/archive/refs/heads/master.zip`;
        const masterResponse = await fetch(masterUrl, { redirect: "follow" });
        if (!masterResponse.ok) {
          return c.json(
            { error: { code: "BAD_REQUEST", message: `Failed to download from GitHub: ${masterResponse.statusText}` } },
            400
          );
        }
        sourceBuffer = Buffer.from(await masterResponse.arrayBuffer());
      } else {
        sourceBuffer = Buffer.from(await response.arrayBuffer());
      }
    } catch (err: any) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: `Failed to clone GitHub repo: ${err.message}` } },
        400
      );
    }
  }

  // Deploy using the version service (creates version record, uploads snapshot, triggers build)
  try {
    const { github_url, ...deployData } = parsed.data;
    const version = await versionService.deploy({
      sandboxId: sandbox.id,
      sourceBuffer: sourceBuffer || Buffer.from(""),
      deployedBy: user.email,
      label: deployData.label,
      migration_sql: deployData.migration_sql,
    });
    return c.json(version, 201);
  } catch (err: any) {
    return c.json(
      { error: { code: "DEPLOY_FAILED", message: err.message } },
      500
    );
  }
});

// GET /api/sandboxes/:id/versions - List versions
versionsRoute.get("/", async (c) => {
  const user = c.get("user");
  const sandboxId = c.req.param("id") || c.req.query("sandboxId");

  const sandbox = await sandboxService.get(sandboxId || "");
  if (!sandbox) {
    return c.json({ error: { code: "NOT_FOUND", message: "Sandbox not found" } }, 404);
  }

  const versions = await versionService.list(sandboxId || "");
  return c.json({ versions });
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

// GET /api/sandboxes/:id/versions/:num/logs/stream - SSE build log streaming
versionsRoute.get("/:num/logs/stream", async (c) => {
  const sandboxId = c.req.param("id") || c.req.query("sandboxId");
  const num = parseInt(c.req.param("num") || "0", 10);

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  const body = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(`data: {"type":"connected","sandbox":"${sandboxId}","version":${num}}\n\n`)
      );
      controller.enqueue(
        encoder.encode(`data: {"type":"log","message":"Build starting..."}\n\n`)
      );
      controller.enqueue(
        encoder.encode(`data: {"type":"complete","status":"success"}\n\n`)
      );
      controller.close();
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
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

  try {
    const version = await versionService.rollback({
      sandboxId: sandbox.id,
      targetVersion: parsed.data.target_version,
    });
    return c.json(version);
  } catch (err: any) {
    return c.json(
      { error: { code: "ROLLBACK_FAILED", message: err.message } },
      400
    );
  }
});
