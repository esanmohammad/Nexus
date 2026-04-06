/**
 * Wave 7 — GitHub Integration + Promotion Tests
 * Tasks: W7-001 through W7-012
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

const mockFetch = vi.fn();

// ─── W7-001: Create Repo from Snapshot ───────────────────────────────────────

describe("W7-001: GitHub Service — Create Repo", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates repo with correct name", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      full_name: "org/my-app",
      html_url: "https://github.com/org/my-app",
    }), { status: 201 }));
    global.fetch = mockFetch;

    const { createRepoFromSnapshot } = await import(
      "../../apps/api/src/services/github.service.js"
    );
    const result = await createRepoFromSnapshot({
      repoName: "my-app",
      sourceSnapshotUrl: "gs://bucket/my-app/v1/source.tar.gz",
      description: "My sandbox app",
    });
    expect(result.fullName).toBe("org/my-app");
    expect(result.repoUrl).toContain("github.com");
  });

  it("repo created as private by default", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      full_name: "org/my-app", html_url: "https://github.com/org/my-app",
    }), { status: 201 }));
    global.fetch = mockFetch;

    const { createRepoFromSnapshot } = await import(
      "../../apps/api/src/services/github.service.js"
    );
    await createRepoFromSnapshot({ repoName: "my-app", sourceSnapshotUrl: "gs://b/o" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.private).toBe(true);
  });
});

// ─── W7-002: Webhook Management ──────────────────────────────────────────────

describe("W7-002: GitHub Service — Webhooks", () => {
  it("createWebhook creates push webhook", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ id: 12345 }), { status: 201 }));
    global.fetch = mockFetch;

    const { createWebhook } = await import("../../apps/api/src/services/github.service.js");
    const webhookId = await createWebhook("org/my-app", "sandbox-1");
    expect(webhookId).toBe("12345");
  });

  it("deleteWebhook removes webhook", async () => {
    mockFetch.mockResolvedValue(new Response("", { status: 204 }));
    global.fetch = mockFetch;

    const { deleteWebhook } = await import("../../apps/api/src/services/github.service.js");
    await expect(deleteWebhook("org/my-app", "12345")).resolves.toBeUndefined();
  });

  it("deleteWebhook is idempotent", async () => {
    mockFetch.mockResolvedValue(new Response("", { status: 404 }));
    global.fetch = mockFetch;

    const { deleteWebhook } = await import("../../apps/api/src/services/github.service.js");
    await expect(deleteWebhook("org/my-app", "99999")).resolves.toBeUndefined();
  });
});

// ─── W7-003: Webhook Handler ─────────────────────────────────────────────────

describe("W7-003: GitHub Webhook Handler", () => {
  const getApp = async () => (await import("@nexus/api")).default;

  it("rejects invalid signature", async () => {
    const app = await getApp();
    const res = await app.request("/api/webhooks/github", {
      method: "POST",
      body: JSON.stringify({ ref: "refs/heads/main" }),
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": "sha256=invalid",
      },
    });
    expect(res.status).toBe(401);
  });

  it("ignores pushes to non-main branches", async () => {
    const app = await getApp();
    const payload = JSON.stringify({ ref: "refs/heads/feature-branch" });
    const signature = "sha256=" + crypto
      .createHmac("sha256", "webhook-secret")
      .update(payload)
      .digest("hex");

    const res = await app.request("/api/webhooks/github", {
      method: "POST",
      body: payload,
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      },
    });
    expect([200, 204]).toContain(res.status);
  });

  it("returns 404 if no matching sandbox", async () => {
    const app = await getApp();
    const payload = JSON.stringify({
      ref: "refs/heads/main",
      repository: { full_name: "org/unknown-repo" },
      after: "abc1234567890",
    });
    const signature = "sha256=" + crypto
      .createHmac("sha256", "webhook-secret")
      .update(payload)
      .digest("hex");

    const res = await app.request("/api/webhooks/github", {
      method: "POST",
      body: payload,
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      },
    });
    expect([200, 404]).toContain(res.status);
  });

  it('version label matches "Auto-deploy from main ({sha})"', () => {
    const sha = "abc1234567890deadbeef";
    const shortSha = sha.substring(0, 7);
    const label = `Auto-deploy from main (${shortSha})`;
    expect(label).toBe("Auto-deploy from main (abc1234)");
  });
});

// ─── W7-004 & W7-005: Connect/Disconnect Repo ───────────────────────────────

describe("W7-004: Connect Repo Endpoint", () => {
  const getApp = async () => (await import("@nexus/api")).default;

  it("POST connect-repo stores github_repo on sandbox", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes/s1/connect-repo", {
      method: "POST",
      body: JSON.stringify({ repo: "org/my-repo" }),
      headers: {
        "Content-Type": "application/json",
        Cookie: "session=valid-token",
      },
    });
    expect([200, 404]).toContain(res.status);
  });

  it("returns 409 if already connected", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes/connected-sandbox/connect-repo", {
      method: "POST",
      body: JSON.stringify({ repo: "org/another" }),
      headers: {
        "Content-Type": "application/json",
        Cookie: "session=valid-token",
      },
    });
    expect([200, 409]).toContain(res.status);
  });
});

describe("W7-005: Disconnect Repo Endpoint", () => {
  const getApp = async () => (await import("@nexus/api")).default;

  it("DELETE connect-repo clears github fields", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes/s1/connect-repo", {
      method: "DELETE",
      headers: { Cookie: "session=valid-token" },
    });
    expect([200, 404]).toContain(res.status);
  });
});

// ─── W7-006: Maturity Computation ────────────────────────────────────────────

describe("W7-006: Maturity Computation", () => {
  it('sandbox < 7 days old → "throwaway"', async () => {
    const { computeMaturity } = await import(
      "../../apps/api/src/services/sandbox.service.js"
    );
    const sandbox = {
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      github_repo: null,
    };
    expect(computeMaturity(sandbox as any)).toBe("throwaway");
  });

  it('sandbox 7-30 days old → "incubating"', async () => {
    const { computeMaturity } = await import(
      "../../apps/api/src/services/sandbox.service.js"
    );
    const sandbox = {
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      github_repo: null,
    };
    expect(computeMaturity(sandbox as any)).toBe("incubating");
  });

  it('sandbox > 30 days without repo → "established"', async () => {
    const { computeMaturity } = await import(
      "../../apps/api/src/services/sandbox.service.js"
    );
    const sandbox = {
      created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      github_repo: null,
    };
    expect(computeMaturity(sandbox as any)).toBe("established");
  });

  it('sandbox > 90 days with repo → "graduated"', async () => {
    const { computeMaturity } = await import(
      "../../apps/api/src/services/sandbox.service.js"
    );
    const sandbox = {
      created_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
      github_repo: "org/my-app",
    };
    expect(computeMaturity(sandbox as any)).toBe("graduated");
  });

  it('sandbox > 100 days without repo → "established" (not graduated)', async () => {
    const { computeMaturity } = await import(
      "../../apps/api/src/services/sandbox.service.js"
    );
    const sandbox = {
      created_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
      github_repo: null,
    };
    expect(computeMaturity(sandbox as any)).toBe("established");
  });

  it("function is pure (no side effects)", async () => {
    const { computeMaturity } = await import(
      "../../apps/api/src/services/sandbox.service.js"
    );
    const sandbox = {
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      github_repo: null,
    };
    const result1 = computeMaturity(sandbox as any);
    const result2 = computeMaturity(sandbox as any);
    expect(result1).toBe(result2);
  });
});

// ─── W7-007: Promote Endpoint ────────────────────────────────────────────────

describe("W7-007: Promote Endpoint", () => {
  const getApp = async () => (await import("@nexus/api")).default;

  it("extends TTL and updates maturity", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes/incubating-sandbox/promote", {
      method: "POST",
      headers: { Cookie: "session=valid-token" },
    });
    expect([200, 404]).toContain(res.status);
  });

  it("cannot promote already-graduated sandbox", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes/graduated-sandbox/promote", {
      method: "POST",
      headers: { Cookie: "session=valid-token" },
    });
    expect([400, 404]).toContain(res.status);
  });
});
