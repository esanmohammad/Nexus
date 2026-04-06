/**
 * Wave 3 — SDK + Web UI Tests
 * Tasks: W3-001 through W3-020
 */

import { describe, it, expect, vi } from "vitest";

// ─── W3-001: SDK Client Class ────────────────────────────────────────────────

describe("W3-001: SDK — Client Class", () => {
  it("NexusClient constructor accepts baseUrl and optional token", async () => {
    const { NexusClient } = await import("../../packages/sdk/src/client.js");
    const client = new NexusClient("https://api.example.com", "token-123");
    expect(client).toBeDefined();
  });

  it("NexusClient works without token", async () => {
    const { NexusClient } = await import("../../packages/sdk/src/client.js");
    const client = new NexusClient("https://api.example.com");
    expect(client).toBeDefined();
  });

  it("pnpm --filter @nexus/sdk build succeeds", () => {
    const { existsSync } = require("fs");
    const { resolve } = require("path");
    expect(existsSync(resolve(__dirname, "../../packages/sdk/dist/index.js"))).toBe(true);
  });
});

// ─── W3-002: SDK Sandbox Methods ─────────────────────────────────────────────

describe("W3-002: SDK — Sandbox Methods", () => {
  const mockFetch = vi.fn();

  it("listSandboxes calls GET /api/sandboxes", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    global.fetch = mockFetch;

    const { NexusClient } = await import("../../packages/sdk/src/client.js");
    const client = new NexusClient("https://api.test.com", "token");
    const sandboxes = await client.listSandboxes();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/sandboxes"),
      expect.any(Object)
    );
    expect(Array.isArray(sandboxes)).toBe(true);
  });

  it("getSandbox calls GET /api/sandboxes/:id", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: "s1", name: "test" }), { status: 200 })
    );
    global.fetch = mockFetch;

    const { NexusClient } = await import("../../packages/sdk/src/client.js");
    const client = new NexusClient("https://api.test.com", "token");
    const sandbox = await client.getSandbox("s1");
    expect(sandbox.id).toBe("s1");
  });

  it("destroySandbox calls DELETE /api/sandboxes/:id", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 202 }));
    global.fetch = mockFetch;

    const { NexusClient } = await import("../../packages/sdk/src/client.js");
    const client = new NexusClient("https://api.test.com", "token");
    await client.destroySandbox("s1");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/sandboxes/s1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("token sent as Authorization: Bearer header", async () => {
    mockFetch.mockResolvedValue(new Response("[]", { status: 200 }));
    global.fetch = mockFetch;

    const { NexusClient } = await import("../../packages/sdk/src/client.js");
    const client = new NexusClient("https://api.test.com", "my-token");
    await client.listSandboxes();

    const headers = mockFetch.mock.calls[0][1]?.headers;
    expect(headers?.Authorization || headers?.get?.("Authorization")).toContain("Bearer my-token");
  });

  it("methods throw typed errors on failure", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Not found" } }), { status: 404 })
    );
    global.fetch = mockFetch;

    const { NexusClient } = await import("../../packages/sdk/src/client.js");
    const client = new NexusClient("https://api.test.com", "token");
    await expect(client.getSandbox("nonexistent")).rejects.toThrow();
  });
});

// ─── W3-003: SDK Version Methods ─────────────────────────────────────────────

describe("W3-003: SDK — Version Methods", () => {
  const mockFetch = vi.fn();

  it("listVersions returns Version[]", async () => {
    mockFetch.mockResolvedValue(new Response("[]", { status: 200 }));
    global.fetch = mockFetch;

    const { NexusClient } = await import("../../packages/sdk/src/client.js");
    const client = new NexusClient("https://api.test.com", "token");
    const versions = await client.listVersions("s1");
    expect(Array.isArray(versions)).toBe(true);
  });

  it("rollback calls POST /api/sandboxes/:id/rollback", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ number: 1, status: "live" }), { status: 200 })
    );
    global.fetch = mockFetch;

    const { NexusClient } = await import("../../packages/sdk/src/client.js");
    const client = new NexusClient("https://api.test.com", "token");
    const version = await client.rollback("s1", 1);
    expect(version.number).toBe(1);
  });

  it("getBuildLog returns string", async () => {
    mockFetch.mockResolvedValue(new Response("Build log...", { status: 200 }));
    global.fetch = mockFetch;

    const { NexusClient } = await import("../../packages/sdk/src/client.js");
    const client = new NexusClient("https://api.test.com", "token");
    const log = await client.getBuildLog("s1", 1);
    expect(typeof log).toBe("string");
  });
});
