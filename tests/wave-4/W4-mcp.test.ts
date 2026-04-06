/**
 * Wave 4 — MCP Server Tests
 * Tasks: W4-014 through W4-018
 */

import { describe, it, expect, vi } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../..");

// ─── W4-014: MCP Server Package ──────────────────────────────────────────────

describe("W4-014: MCP Server — Package Scaffold", () => {
  it("apps/mcp-server/package.json exists", () => {
    expect(existsSync(resolve(ROOT, "apps/mcp-server/package.json"))).toBe(true);
  });

  it('package name is "@nexus/mcp-server"', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(ROOT, "apps/mcp-server/package.json"), "utf-8")
    );
    expect(pkg.name).toBe("@nexus/mcp-server");
  });

  it("@modelcontextprotocol/sdk is a dependency", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(ROOT, "apps/mcp-server/package.json"), "utf-8")
    );
    expect(pkg.dependencies).toHaveProperty("@modelcontextprotocol/sdk");
  });

  it("@nexus/sdk is a dependency", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(ROOT, "apps/mcp-server/package.json"), "utf-8")
    );
    expect(pkg.dependencies).toHaveProperty("@nexus/sdk");
  });
});

// ─── W4-015: Tool Definitions ────────────────────────────────────────────────

describe("W4-015: MCP Server — Tool Definitions", () => {
  const expectedTools = [
    "sandbox_create",
    "sandbox_deploy",
    "sandbox_rollback",
    "sandbox_status",
    "sandbox_share",
    "sandbox_logs",
    "sandbox_list",
    "sandbox_destroy",
    "sandbox_extend",
  ];

  it("all 9 tools are defined", async () => {
    const tools = await import("../../apps/mcp-server/src/tools/index.js");
    const toolList = tools.getAllTools ? tools.getAllTools() : [];
    expect(toolList.length).toBe(9);
  });

  it("each tool has name, description, inputSchema", async () => {
    const tools = await import("../../apps/mcp-server/src/tools/index.js");
    const toolList = tools.getAllTools ? tools.getAllTools() : [];
    for (const tool of toolList) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("each tool name is unique", async () => {
    const tools = await import("../../apps/mcp-server/src/tools/index.js");
    const toolList = tools.getAllTools ? tools.getAllTools() : [];
    const names = toolList.map((t: any) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("expected tool names match", async () => {
    const tools = await import("../../apps/mcp-server/src/tools/index.js");
    const toolList = tools.getAllTools ? tools.getAllTools() : [];
    const names = toolList.map((t: any) => t.name);
    for (const expected of expectedTools) {
      expect(names).toContain(expected);
    }
  });

  it("sandbox_create requires name and source_path", async () => {
    const tools = await import("../../apps/mcp-server/src/tools/index.js");
    const toolList = tools.getAllTools ? tools.getAllTools() : [];
    const create = toolList.find((t: any) => t.name === "sandbox_create");
    expect(create?.inputSchema.required).toContain("name");
    expect(create?.inputSchema.required).toContain("source_path");
  });

  it("sandbox_destroy requires name and confirm", async () => {
    const tools = await import("../../apps/mcp-server/src/tools/index.js");
    const toolList = tools.getAllTools ? tools.getAllTools() : [];
    const destroy = toolList.find((t: any) => t.name === "sandbox_destroy");
    expect(destroy?.inputSchema.required).toContain("name");
    expect(destroy?.inputSchema.required).toContain("confirm");
  });
});

// ─── W4-016: Tool Handlers ───────────────────────────────────────────────────

describe("W4-016: MCP Server — Tool Handlers", () => {
  it('each handler returns { content: [{ type: "text", text }] }', async () => {
    const { handleSandboxList } = await import(
      "../../apps/mcp-server/src/tools/sandbox-list.js"
    );
    const result = await handleSandboxList({});
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe("text");
    expect(typeof result.content[0].text).toBe("string");
  });

  it('sandbox_deploy returns "v{N} is live at {URL}"', async () => {
    const { handleSandboxDeploy } = await import(
      "../../apps/mcp-server/src/tools/sandbox-deploy.js"
    );
    const result = await handleSandboxDeploy({
      name: "test-app",
      source_path: "/tmp/test",
    });
    expect(result.content[0].text).toMatch(/v\d+.*live.*http/i);
  });

  it("sandbox_destroy requires confirm: true", async () => {
    const { handleSandboxDestroy } = await import(
      "../../apps/mcp-server/src/tools/sandbox-destroy.js"
    );
    const result = await handleSandboxDestroy({
      name: "test-app",
      confirm: false,
    });
    expect(result.content[0].text).toMatch(/confirm/i);
  });

  it("handlers catch errors and return readable messages", async () => {
    const { handleSandboxStatus } = await import(
      "../../apps/mcp-server/src/tools/sandbox-status.js"
    );
    const result = await handleSandboxStatus({ name: "nonexistent-app" });
    expect(result.content[0].text).toBeDefined();
    // Should not throw, should return error text
  });
});

// ─── W4-017: Auth Configuration ──────────────────────────────────────────────

describe("W4-017: MCP Server — Auth Configuration", () => {
  it("fails with clear error if NEXUS_API_URL missing", async () => {
    delete process.env.NEXUS_API_URL;
    delete process.env.NEXUS_TOKEN;
    await expect(async () => {
      await import("../../apps/mcp-server/src/index.js?t=nourl");
    }).rejects.toThrow(/NEXUS_API_URL/);
  });

  it("fails with clear error if NEXUS_TOKEN missing", async () => {
    process.env.NEXUS_API_URL = "https://api.test.com";
    delete process.env.NEXUS_TOKEN;
    await expect(async () => {
      await import("../../apps/mcp-server/src/index.js?t=notoken");
    }).rejects.toThrow(/NEXUS_TOKEN/);
  });
});

// ─── W4-018: Integration ─────────────────────────────────────────────────────

describe("W4-018: MCP Server — Integration", () => {
  it("ListTools returns exactly 9 tools", async () => {
    const tools = await import("../../apps/mcp-server/src/tools/index.js");
    const allTools = tools.getAllTools ? tools.getAllTools() : [];
    expect(allTools).toHaveLength(9);
  });
});
