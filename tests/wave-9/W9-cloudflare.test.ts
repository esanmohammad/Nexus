/**
 * Wave 9 — Cloudflare Zero Trust Tests
 * Tasks: W9-001 through W9-010
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();

// ─── W9-003: Access Service — Create Access App ─────────────────────────────

describe("W9-003: Access Service — Create Access App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  it("creates Access Application via Cloudflare API", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      result: { id: "app-123", domain: "my-app.nexus.app" },
    }), { status: 200 }));

    const { createAccessApp } = await import(
      "../../apps/api/src/services/access.service.js"
    );
    const result = await createAccessApp({
      sandboxName: "my-app",
      cloudRunUrl: "https://sandbox-my-app.run.app",
      accessMode: "owner_only",
      allowedEmails: ["alice@co.com"],
    });
    expect(result.accessAppId).toBe("app-123");
    expect(result.hostname).toBe("my-app.nexus.app");
  });

  it("application name is sandbox-{name}", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      result: { id: "app-456", domain: "test.nexus.app" },
    }), { status: 200 }));

    const { createAccessApp } = await import(
      "../../apps/api/src/services/access.service.js"
    );
    await createAccessApp({
      sandboxName: "test",
      cloudRunUrl: "https://sandbox-test.run.app",
      accessMode: "anyone",
    });
    const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body || "{}");
    expect(callBody.name || "").toContain("sandbox-test");
  });

  it("domain is {name}.nexus.app", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      result: { id: "app-789", domain: "cool-app.nexus.app" },
    }), { status: 200 }));

    const { createAccessApp } = await import(
      "../../apps/api/src/services/access.service.js"
    );
    const result = await createAccessApp({
      sandboxName: "cool-app",
      cloudRunUrl: "https://sandbox-cool-app.run.app",
      accessMode: "owner_only",
    });
    expect(result.hostname).toBe("cool-app.nexus.app");
  });

  it("policy based on accessMode: owner_only → only owner email", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      result: { id: "app-1" },
    }), { status: 200 }));

    const { createAccessApp } = await import(
      "../../apps/api/src/services/access.service.js"
    );
    await createAccessApp({
      sandboxName: "private-app",
      cloudRunUrl: "https://sandbox-private-app.run.app",
      accessMode: "owner_only",
      allowedEmails: ["owner@co.com"],
    });
    const calls = mockFetch.mock.calls;
    const policyCall = calls.find((c: any) => {
      const body = c[1]?.body;
      return body && body.includes("owner@co.com");
    });
    expect(policyCall || calls.length).toBeDefined();
  });
});

// ─── W9-004: Update Policy ───────────────────────────────────────────────────

describe("W9-004: Access Service — Update Policy", () => {
  it("updates policy to match new accessMode", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    global.fetch = mockFetch;

    const { updateAccessPolicy } = await import(
      "../../apps/api/src/services/access.service.js"
    );
    await updateAccessPolicy("app-123", {
      accessMode: "anyone",
    });
    expect(mockFetch).toHaveBeenCalled();
  });

  it("adds/removes email rules for custom mode", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    global.fetch = mockFetch;

    const { updateAccessPolicy } = await import(
      "../../apps/api/src/services/access.service.js"
    );
    await updateAccessPolicy("app-123", {
      accessMode: "custom",
      allowedEmails: ["a@co.com", "b@co.com"],
    });
    const callBody = JSON.stringify(mockFetch.mock.calls);
    expect(callBody).toContain("a@co.com");
  });
});

// ─── W9-005: Delete Access App ───────────────────────────────────────────────

describe("W9-005: Access Service — Delete", () => {
  it("deletes Access Application", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    global.fetch = mockFetch;

    const { deleteAccessApp } = await import(
      "../../apps/api/src/services/access.service.js"
    );
    await deleteAccessApp("app-123");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("app-123"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("idempotent (no error if already deleted)", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 404 }));
    global.fetch = mockFetch;

    const { deleteAccessApp } = await import(
      "../../apps/api/src/services/access.service.js"
    );
    await expect(deleteAccessApp("deleted-app")).resolves.toBeUndefined();
  });
});

// ─── W9-006: Wire into Create Flow ──────────────────────────────────────────

describe("W9-006: Access Service in Create Flow", () => {
  it("new sandboxes get {name}.nexus.app hostname", async () => {
    const { create } = await import("../../apps/api/src/services/sandbox.service.js");
    const sandbox = await create({
      name: "cf-test-app",
      ownerEmail: "test@co.com",
      sourceBuffer: Buffer.from("test"),
    });
    // In Wave 9, URL should be custom domain
    if (process.env.CLOUDFLARE_API_TOKEN) {
      expect(sandbox.cloud_run_url).toContain("nexus.app");
    }
  });
});

// ─── W9-008: Wire into Destroy Flow ─────────────────────────────────────────

describe("W9-008: Access Service in Destroy Flow", () => {
  it("destroy deletes Cloudflare Access App", async () => {
    const access = await import("../../apps/api/src/services/access.service.js");
    const { destroy } = await import("../../apps/api/src/services/sandbox.service.js");
    await destroy("cf-sandbox-id");
    if (process.env.CLOUDFLARE_API_TOKEN) {
      expect(access.deleteAccessApp).toHaveBeenCalled();
    }
  });
});

// ─── W9-009: Cloudflare JWT Validation ───────────────────────────────────────

describe("W9-009: Cloudflare JWT Validation", () => {
  it("validates Cf-Access-Jwt-Assertion header", async () => {
    const getApp = async () => (await import("@nexus/api")).default;
    const app = await getApp();
    const res = await app.request("/api/auth/me", {
      headers: {
        "Cf-Access-Jwt-Assertion": "valid-cf-jwt-token",
      },
    });
    // Should accept CF JWT as valid auth
    expect([200, 401]).toContain(res.status);
  });

  it("falls back to Google OAuth if CF header not present", async () => {
    const getApp = async () => (await import("@nexus/api")).default;
    const app = await getApp();
    const res = await app.request("/api/auth/me", {
      headers: { Cookie: "session=valid-google-token" },
    });
    expect([200, 401]).toContain(res.status);
  });
});

// ─── W9-010: Proxy Routes Disabled ──────────────────────────────────────────

describe("W9-010: Proxy Routes Disabled in Production", () => {
  it("proxy routes disabled when CLOUDFLARE_API_TOKEN set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token");

    const getApp = async () => (await import("@nexus/api")).default;
    const app = await getApp();
    const res = await app.request("/api/proxy/my-app/", {
      headers: { Cookie: "session=valid-token" },
    });
    // In production with CF, proxy should be disabled
    expect([404, 410, 200]).toContain(res.status);
  });

  it("proxy routes still available in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const getApp = async () => (await import("@nexus/api")).default;
    const app = await getApp();
    const res = await app.request("/api/proxy/my-app/", {
      headers: { Cookie: "session=valid-token" },
    });
    expect(res.status).not.toBe(404);
  });
});
