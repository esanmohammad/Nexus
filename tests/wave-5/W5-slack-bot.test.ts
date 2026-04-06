/**
 * Wave 5 — Slack Bot Tests
 * Tasks: W5-002 through W5-014
 */

import { describe, it, expect, vi } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../..");

// ─── W5-002: Package Scaffold ────────────────────────────────────────────────

describe("W5-002: Slack Bot — Package Scaffold", () => {
  it("apps/slack-bot/package.json exists", () => {
    expect(existsSync(resolve(ROOT, "apps/slack-bot/package.json"))).toBe(true);
  });

  it("@slack/bolt is a dependency", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(ROOT, "apps/slack-bot/package.json"), "utf-8")
    );
    expect(pkg.dependencies).toHaveProperty("@slack/bolt");
  });

  it("Dockerfile exists", () => {
    expect(existsSync(resolve(ROOT, "apps/slack-bot/Dockerfile"))).toBe(true);
  });
});

// ─── W5-004: Message Parser ──────────────────────────────────────────────────

describe("W5-004: Slack Bot — Message Parser", () => {
  it('parses "create my-app"', async () => {
    const { parseMessage } = await import("../../apps/slack-bot/src/lib/parser.js");
    const result = parseMessage("create my-app");
    expect(result.command).toBe("create");
    expect(result.name).toBe("my-app");
  });

  it('parses "deploy my-app"', async () => {
    const { parseMessage } = await import("../../apps/slack-bot/src/lib/parser.js");
    const result = parseMessage("deploy my-app");
    expect(result.command).toBe("deploy");
    expect(result.name).toBe("my-app");
  });

  it('parses "rollback my-app"', async () => {
    const { parseMessage } = await import("../../apps/slack-bot/src/lib/parser.js");
    const result = parseMessage("rollback my-app");
    expect(result.command).toBe("rollback");
    expect(result.name).toBe("my-app");
  });

  it('parses "status my-app"', async () => {
    const { parseMessage } = await import("../../apps/slack-bot/src/lib/parser.js");
    const result = parseMessage("status my-app");
    expect(result.command).toBe("status");
    expect(result.name).toBe("my-app");
  });

  it('parses "share my-app with @user"', async () => {
    const { parseMessage } = await import("../../apps/slack-bot/src/lib/parser.js");
    const result = parseMessage("share my-app with @user");
    expect(result.command).toBe("share");
    expect(result.name).toBe("my-app");
    expect(result.target).toBe("@user");
  });

  it('parses "extend my-app 30d"', async () => {
    const { parseMessage } = await import("../../apps/slack-bot/src/lib/parser.js");
    const result = parseMessage("extend my-app 30d");
    expect(result.command).toBe("extend");
    expect(result.name).toBe("my-app");
    expect(result.duration).toBe("30d");
  });

  it('parses "destroy my-app"', async () => {
    const { parseMessage } = await import("../../apps/slack-bot/src/lib/parser.js");
    const result = parseMessage("destroy my-app");
    expect(result.command).toBe("destroy");
    expect(result.name).toBe("my-app");
  });

  it('returns { command: "unknown" } for unrecognized input', async () => {
    const { parseMessage } = await import("../../apps/slack-bot/src/lib/parser.js");
    const result = parseMessage("hello there");
    expect(result.command).toBe("unknown");
  });
});

// ─── W5-005: Block Kit Builders ──────────────────────────────────────────────

describe("W5-005: Slack Bot — Block Kit Builders", () => {
  const mockSandbox = {
    id: "s1", name: "my-app", cloud_run_url: "https://sandbox-my-app.run.app",
    state: "running", current_version: 2,
  };
  const mockVersion = { number: 2, label: "Fix chart", status: "live" };

  it("buildDeploySuccessMessage returns valid blocks", async () => {
    const { buildDeploySuccessMessage } = await import(
      "../../apps/slack-bot/src/lib/blocks.js"
    );
    const msg = buildDeploySuccessMessage(mockSandbox, mockVersion);
    expect(msg.blocks).toBeDefined();
    expect(Array.isArray(msg.blocks)).toBe(true);
    expect(msg.blocks.length).toBeGreaterThan(0);
  });

  it("deploy success message includes URL", async () => {
    const { buildDeploySuccessMessage } = await import(
      "../../apps/slack-bot/src/lib/blocks.js"
    );
    const msg = buildDeploySuccessMessage(mockSandbox, mockVersion);
    const text = JSON.stringify(msg);
    expect(text).toContain(mockSandbox.cloud_run_url);
  });

  it("deploy success message includes action buttons", async () => {
    const { buildDeploySuccessMessage } = await import(
      "../../apps/slack-bot/src/lib/blocks.js"
    );
    const msg = buildDeploySuccessMessage(mockSandbox, mockVersion);
    const actions = msg.blocks.find((b: any) => b.type === "actions");
    expect(actions).toBeDefined();
    expect(actions.elements.length).toBeGreaterThanOrEqual(3);
  });

  it("buildExpiryWarningMessage includes extend button", async () => {
    const { buildExpiryWarningMessage } = await import(
      "../../apps/slack-bot/src/lib/blocks.js"
    );
    const msg = buildExpiryWarningMessage(mockSandbox, 24);
    const text = JSON.stringify(msg);
    expect(text).toContain("extend");
  });

  it("buildDeployFailureMessage includes error info", async () => {
    const { buildDeployFailureMessage } = await import(
      "../../apps/slack-bot/src/lib/blocks.js"
    );
    const msg = buildDeployFailureMessage(mockSandbox, "npm install failed");
    const text = JSON.stringify(msg);
    expect(text).toContain("failed");
  });

  it("buildStatusMessage includes sandbox info", async () => {
    const { buildStatusMessage } = await import(
      "../../apps/slack-bot/src/lib/blocks.js"
    );
    const msg = buildStatusMessage(mockSandbox, [mockVersion]);
    const text = JSON.stringify(msg);
    expect(text).toContain("my-app");
  });
});

// ─── W5-006: Create Handler ──────────────────────────────────────────────────

describe("W5-006: Slack Bot — Create Handler", () => {
  it("handler function exists", async () => {
    const { handleCreate } = await import(
      "../../apps/slack-bot/src/handlers/create.js"
    );
    expect(typeof handleCreate).toBe("function");
  });
});

// ─── W5-007: Deploy Handler ──────────────────────────────────────────────────

describe("W5-007: Slack Bot — Deploy Handler", () => {
  it("handler function exists", async () => {
    const { handleDeploy } = await import(
      "../../apps/slack-bot/src/handlers/deploy.js"
    );
    expect(typeof handleDeploy).toBe("function");
  });
});

// ─── W5-012: Notification Service ────────────────────────────────────────────

describe("W5-012: Notification Service", () => {
  it("sendExpiryWarning function exists", async () => {
    const { sendExpiryWarning } = await import(
      "../../apps/api/src/services/notification.service.js"
    );
    expect(typeof sendExpiryWarning).toBe("function");
  });

  it("sendDeploySuccess function exists", async () => {
    const { sendDeploySuccess } = await import(
      "../../apps/api/src/services/notification.service.js"
    );
    expect(typeof sendDeploySuccess).toBe("function");
  });

  it("sendDeployFailure function exists", async () => {
    const { sendDeployFailure } = await import(
      "../../apps/api/src/services/notification.service.js"
    );
    expect(typeof sendDeployFailure).toBe("function");
  });

  it("falls back gracefully when Slack not configured", async () => {
    delete process.env.SLACK_BOT_TOKEN;
    const { sendExpiryWarning } = await import(
      "../../apps/api/src/services/notification.service.js"
    );
    // Should not throw, just log
    await expect(
      sendExpiryWarning({ id: "s1", name: "test", owner_email: "a@b.com" } as any, 72)
    ).resolves.toBeUndefined();
  });
});
