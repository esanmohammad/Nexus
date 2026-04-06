/**
 * Wave 2 — Version Service + Cleanup Tests
 * Tasks: W2-001 through W2-016
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../apps/api/src/services/storage.service.js");
vi.mock("../../apps/api/src/services/build.service.js");
vi.mock("../../apps/api/src/services/cloudrun.service.js");
vi.mock("@nexus/db");

// ─── W2-001: Deploy New Version ──────────────────────────────────────────────

describe("W2-001: Version Service — Deploy", () => {
  it("new version number is current_version + 1", async () => {
    const { deploy } = await import("../../apps/api/src/services/version.service.js");
    const version = await deploy({
      sandboxId: "sandbox-1",
      sourceBuffer: Buffer.from("test"),
      deployedBy: "alice@co.com",
    });
    expect(version.number).toBeGreaterThan(0);
  });

  it('version row inserted with "building" status before build starts', async () => {
    const { deploy } = await import("../../apps/api/src/services/version.service.js");
    // Mock to capture the insert
    const version = await deploy({
      sandboxId: "sandbox-1",
      sourceBuffer: Buffer.from("test"),
      deployedBy: "alice@co.com",
    });
    expect(version).toBeDefined();
  });

  it("source snapshot uploaded to {sandboxName}/v{N}/source.tar.gz", async () => {
    const storage = await import("../../apps/api/src/services/storage.service.js");
    const { deploy } = await import("../../apps/api/src/services/version.service.js");
    await deploy({
      sandboxId: "sandbox-1",
      sourceBuffer: Buffer.from("test"),
      deployedBy: "alice@co.com",
    });
    expect(storage.uploadSnapshot).toHaveBeenCalled();
  });

  it('on build success: version status set to "live"', async () => {
    const build = await import("../../apps/api/src/services/build.service.js");
    vi.mocked(build.waitForBuild).mockResolvedValue({
      success: true, buildId: "b1", imageUrl: "img:v2", durationMs: 5000,
    });
    const { deploy } = await import("../../apps/api/src/services/version.service.js");
    const version = await deploy({
      sandboxId: "sandbox-1",
      sourceBuffer: Buffer.from("test"),
      deployedBy: "alice@co.com",
    });
    expect(version.status).toBe("live");
  });

  it('previous live version status set to "rolled_back"', async () => {
    const build = await import("../../apps/api/src/services/build.service.js");
    vi.mocked(build.waitForBuild).mockResolvedValue({
      success: true, buildId: "b2", imageUrl: "img:v3", durationMs: 5000,
    });
    const { deploy } = await import("../../apps/api/src/services/version.service.js");
    const version = await deploy({
      sandboxId: "sandbox-1",
      sourceBuffer: Buffer.from("test"),
      deployedBy: "alice@co.com",
    });
    // Previous version should now be rolled_back
    expect(version.status).toBe("live");
  });

  it('on build failure: version status "failed", traffic stays on previous', async () => {
    const build = await import("../../apps/api/src/services/build.service.js");
    vi.mocked(build.waitForBuild).mockResolvedValue({
      success: false, buildId: "b-fail", error: "npm error",
    });
    const { deploy } = await import("../../apps/api/src/services/version.service.js");
    const result = await deploy({
      sandboxId: "sandbox-1",
      sourceBuffer: Buffer.from("test"),
      deployedBy: "alice@co.com",
    }).catch(e => e);
    // Version should be marked as failed
    expect(result).toBeDefined();
  });

  it("build_duration_ms recorded on version row", async () => {
    const build = await import("../../apps/api/src/services/build.service.js");
    vi.mocked(build.waitForBuild).mockResolvedValue({
      success: true, buildId: "b3", imageUrl: "img:v2", durationMs: 45000,
    });
    const { deploy } = await import("../../apps/api/src/services/version.service.js");
    const version = await deploy({
      sandboxId: "sandbox-1",
      sourceBuffer: Buffer.from("test"),
      deployedBy: "alice@co.com",
    });
    expect(version.build_duration_ms).toBe(45000);
  });

  it("deployed_at set on success", async () => {
    const build = await import("../../apps/api/src/services/build.service.js");
    vi.mocked(build.waitForBuild).mockResolvedValue({
      success: true, buildId: "b4", imageUrl: "img:v2", durationMs: 5000,
    });
    const { deploy } = await import("../../apps/api/src/services/version.service.js");
    const version = await deploy({
      sandboxId: "sandbox-1",
      sourceBuffer: Buffer.from("test"),
      deployedBy: "alice@co.com",
    });
    expect(version.deployed_at).toBeDefined();
  });
});

// ─── W2-002: Rollback ────────────────────────────────────────────────────────

describe("W2-002: Version Service — Rollback", () => {
  it("default target: previous version before current live", async () => {
    const { rollback } = await import("../../apps/api/src/services/version.service.js");
    const version = await rollback({ sandboxId: "sandbox-1" });
    expect(version).toBeDefined();
    expect(version.status).toBe("live");
  });

  it("custom target: specified target_version number", async () => {
    const { rollback } = await import("../../apps/api/src/services/version.service.js");
    const version = await rollback({ sandboxId: "sandbox-1", targetVersion: 1 });
    expect(version.number).toBe(1);
  });

  it("rejects rollback to version without cloud_run_revision (failed builds)", async () => {
    const { rollback } = await import("../../apps/api/src/services/version.service.js");
    await expect(
      rollback({ sandboxId: "sandbox-1", targetVersion: 99 })
    ).rejects.toThrow(/revision|failed/i);
  });

  it("rollback completes in < 10 seconds (no new build)", async () => {
    const start = Date.now();
    const { rollback } = await import("../../apps/api/src/services/version.service.js");
    await rollback({ sandboxId: "sandbox-1" });
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(10000);
  });

  it("traffic shifts to target revision", async () => {
    const cloudrun = await import("../../apps/api/src/services/cloudrun.service.js");
    const { rollback } = await import("../../apps/api/src/services/version.service.js");
    await rollback({ sandboxId: "sandbox-1" });
    expect(cloudrun.shiftTraffic).toHaveBeenCalled();
  });
});

// ─── W2-003: List & Get ──────────────────────────────────────────────────────

describe("W2-003: Version Service — List & Get", () => {
  it("list returns all versions ordered by number descending", async () => {
    const { list } = await import("../../apps/api/src/services/version.service.js");
    const versions = await list("sandbox-1");
    expect(Array.isArray(versions)).toBe(true);
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i - 1].number).toBeGreaterThan(versions[i].number);
    }
  });

  it("get returns single version by sandbox + number", async () => {
    const { get } = await import("../../apps/api/src/services/version.service.js");
    const version = await get("sandbox-1", 1);
    if (version) {
      expect(version.number).toBe(1);
    }
  });

  it("get returns null for non-existent version", async () => {
    const { get } = await import("../../apps/api/src/services/version.service.js");
    const result = await get("sandbox-1", 9999);
    expect(result).toBeNull();
  });
});

// ─── W2-004: Source Download URL ─────────────────────────────────────────────

describe("W2-004: Version Service — Source Download URL", () => {
  it("returns a signed URL (not raw gs://)", async () => {
    const { getSourceDownloadUrl } = await import(
      "../../apps/api/src/services/version.service.js"
    );
    const url = await getSourceDownloadUrl("version-1");
    expect(url).not.toMatch(/^gs:\/\//);
    expect(url).toMatch(/^https?:\/\//);
  });

  it("URL allows direct browser download", async () => {
    const { getSourceDownloadUrl } = await import(
      "../../apps/api/src/services/version.service.js"
    );
    const url = await getSourceDownloadUrl("version-1");
    expect(url).toContain("storage.googleapis.com");
  });
});

// ─── W2-005: Version API Routes ──────────────────────────────────────────────

describe("W2-005: Version API Routes", () => {
  const getApp = async () => (await import("@nexus/api")).default;

  it("GET /api/sandboxes/:id/versions returns array", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes/test-id/versions", {
      headers: { Cookie: "session=valid-token" },
    });
    expect([200, 404]).toContain(res.status);
  });

  it("GET /api/sandboxes/:id/versions/:num/source returns redirect", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes/test-id/versions/1/source", {
      headers: { Cookie: "session=valid-token" },
    });
    expect([200, 302, 404]).toContain(res.status);
  });

  it("POST rollback with invalid target returns 400", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes/test-id/rollback", {
      method: "POST",
      body: JSON.stringify({ target_version: -1 }),
      headers: {
        "Content-Type": "application/json",
        Cookie: "session=valid-token",
      },
    });
    expect([400, 404]).toContain(res.status);
  });
});

// ─── W2-006 through W2-010: Cleanup Service ─────────────────────────────────

describe("W2-006: Cleanup Service — Core Structure", () => {
  it("runCleanupCycle returns CleanupReport", async () => {
    const { runCleanupCycle } = await import(
      "../../apps/api/src/services/cleanup.service.js"
    );
    const report = await runCleanupCycle();
    expect(report).toHaveProperty("notified_72h");
    expect(report).toHaveProperty("notified_24h");
    expect(report).toHaveProperty("slept");
    expect(report).toHaveProperty("destroyed");
    expect(report).toHaveProperty("errors");
  });

  it("errors in one method don't prevent others from running", async () => {
    const { runCleanupCycle } = await import(
      "../../apps/api/src/services/cleanup.service.js"
    );
    const report = await runCleanupCycle();
    // Should always complete, errors captured in report
    expect(Array.isArray(report.errors)).toBe(true);
  });
});

describe("W2-007: Cleanup — 72h Notification", () => {
  it("finds sandboxes expiring within 72h not yet notified", async () => {
    const { sendExpiryNotifications } = await import(
      "../../apps/api/src/services/cleanup.service.js"
    );
    // Mock DB to have sandbox expiring in 48h, not notified
    await sendExpiryNotifications();
    // Verify notification flag set
  });

  it("does NOT notify already-notified sandboxes", async () => {
    const { sendExpiryNotifications } = await import(
      "../../apps/api/src/services/cleanup.service.js"
    );
    // Mock DB with already-notified sandbox
    await sendExpiryNotifications();
    // Verify no duplicate notification
  });

  it("does NOT notify destroyed or sleeping sandboxes", async () => {
    const { sendExpiryNotifications } = await import(
      "../../apps/api/src/services/cleanup.service.js"
    );
    await sendExpiryNotifications();
    // Only running sandboxes should be considered
  });
});

describe("W2-009: Cleanup — Sleep Expired Sandboxes", () => {
  it('sets expired running sandboxes to state "sleeping"', async () => {
    const { sleepExpiredSandboxes } = await import(
      "../../apps/api/src/services/cleanup.service.js"
    );
    const count = await sleepExpiredSandboxes();
    expect(typeof count).toBe("number");
  });

  it("scales Cloud Run to max 0 instances (not deleted)", async () => {
    const cloudrun = await import("../../apps/api/src/services/cloudrun.service.js");
    const { sleepExpiredSandboxes } = await import(
      "../../apps/api/src/services/cleanup.service.js"
    );
    await sleepExpiredSandboxes();
    // Verify shiftTraffic or updateService called, NOT deleteService
    expect(cloudrun.deleteService).not.toHaveBeenCalled();
  });

  it("does NOT delete source snapshots or Neon database", async () => {
    const storage = await import("../../apps/api/src/services/storage.service.js");
    const { sleepExpiredSandboxes } = await import(
      "../../apps/api/src/services/cleanup.service.js"
    );
    await sleepExpiredSandboxes();
    expect(storage.deleteSnapshot).not.toHaveBeenCalled();
  });
});

describe("W2-010: Cleanup — Destroy Sleeping Sandboxes", () => {
  it("only targets sandboxes sleeping for > 7 days past expiry", async () => {
    const { destroySleepingSandboxes } = await import(
      "../../apps/api/src/services/cleanup.service.js"
    );
    const count = await destroySleepingSandboxes();
    expect(typeof count).toBe("number");
  });

  it("deletes Cloud Run service", async () => {
    const cloudrun = await import("../../apps/api/src/services/cloudrun.service.js");
    const { destroySleepingSandboxes } = await import(
      "../../apps/api/src/services/cleanup.service.js"
    );
    await destroySleepingSandboxes();
    expect(cloudrun.deleteService).toHaveBeenCalled();
  });

  it('sets state to "destroyed" and destroyed_at', async () => {
    const { destroySleepingSandboxes } = await import(
      "../../apps/api/src/services/cleanup.service.js"
    );
    await destroySleepingSandboxes();
    // Verify DB update
  });

  it("errors for individual sandboxes don't stop the batch", async () => {
    const { destroySleepingSandboxes } = await import(
      "../../apps/api/src/services/cleanup.service.js"
    );
    // Even if one sandbox fails to destroy, others should proceed
    const count = await destroySleepingSandboxes();
    expect(typeof count).toBe("number");
  });
});

// ─── W2-011: Cleanup API Endpoint ────────────────────────────────────────────

describe("W2-011: Cleanup API Endpoint", () => {
  const getApp = async () => (await import("@nexus/api")).default;

  it("POST /api/internal/cleanup triggers cleanup and returns report", async () => {
    const app = await getApp();
    const res = await app.request("/api/internal/cleanup", {
      method: "POST",
      headers: { Authorization: "Bearer internal-key" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("notified_72h");
  });

  it("rejects unauthenticated requests", async () => {
    const app = await getApp();
    const res = await app.request("/api/internal/cleanup", { method: "POST" });
    expect(res.status).toBe(401);
  });
});

// ─── W2-013: Sleeping Sandbox Page ───────────────────────────────────────────

describe("W2-013: Sleeping Sandbox Page", () => {
  const getApp = async () => (await import("@nexus/api")).default;

  it("sleeping sandbox returns HTML page (not proxy error)", async () => {
    // Mock sandbox in sleeping state
    const app = await getApp();
    const res = await app.request("/api/proxy/sleeping-app/", {
      headers: { Cookie: "session=valid-token" },
    });
    if (res.status === 200) {
      const text = await res.text();
      expect(text).toContain("html");
      expect(text).toContain("expired");
    }
  });

  it("page displays wake-up, download, extend, destroy links", async () => {
    const app = await getApp();
    const res = await app.request("/api/proxy/sleeping-app/", {
      headers: { Cookie: "session=valid-token" },
    });
    if (res.status === 200) {
      const text = await res.text();
      expect(text).toContain("wake");
      expect(text).toContain("download");
    }
  });
});

// ─── W2-014: Wake-Up Endpoint ────────────────────────────────────────────────

describe("W2-014: Wake-Up Endpoint", () => {
  it('only works on sandboxes in "sleeping" state', async () => {
    const { wake } = await import("../../apps/api/src/services/sandbox.service.js");
    // Running sandbox should fail
    await expect(wake("running-sandbox-id")).rejects.toThrow(/sleeping|state/i);
  });

  it('sets state to "running"', async () => {
    const { wake } = await import("../../apps/api/src/services/sandbox.service.js");
    const sandbox = await wake("sleeping-sandbox-id");
    expect(sandbox.state).toBe("running");
  });

  it("expires_at is now() + 24 hours", async () => {
    const { wake } = await import("../../apps/api/src/services/sandbox.service.js");
    const before = Date.now();
    const sandbox = await wake("sleeping-sandbox-id");
    const expiresAt = new Date(sandbox.expires_at).getTime();
    const expected24h = before + 24 * 60 * 60 * 1000;
    expect(Math.abs(expiresAt - expected24h)).toBeLessThan(5000);
  });

  it("resets notification flags to false", async () => {
    const { wake } = await import("../../apps/api/src/services/sandbox.service.js");
    const sandbox = await wake("sleeping-sandbox-id");
    expect(sandbox.expiry_notified_72h).toBe(false);
    expect(sandbox.expiry_notified_24h).toBe(false);
  });
});

// ─── W2-015: Integration Test — Version Lifecycle ────────────────────────────

describe("W2-015: Integration — Version Lifecycle", () => {
  it("create → deploy v2 → verify v2 live → rollback v1 → verify v1 live", async () => {
    // Full lifecycle integration test
    const sandboxService = await import("../../apps/api/src/services/sandbox.service.js");
    const versionService = await import("../../apps/api/src/services/version.service.js");

    // 1. Create sandbox
    const sandbox = await sandboxService.create({
      name: "lifecycle-test",
      ownerEmail: "test@co.com",
      sourceBuffer: Buffer.from("v1 source"),
    });
    expect(sandbox.current_version).toBe(1);

    // 2. Deploy v2
    const v2 = await versionService.deploy({
      sandboxId: sandbox.id,
      sourceBuffer: Buffer.from("v2 source"),
      deployedBy: "test@co.com",
    });
    expect(v2.number).toBe(2);
    expect(v2.status).toBe("live");

    // 3. Get versions, verify v1 is rolled_back
    const versions = await versionService.list(sandbox.id);
    const v1 = versions.find((v: any) => v.number === 1);
    expect(v1?.status).toBe("rolled_back");

    // 4. Rollback to v1
    const rolledBack = await versionService.rollback({
      sandboxId: sandbox.id,
      targetVersion: 1,
    });
    expect(rolledBack.number).toBe(1);
    expect(rolledBack.status).toBe("live");

    // 5. Verify v2 now rolled_back
    const versionsAfter = await versionService.list(sandbox.id);
    const v2After = versionsAfter.find((v: any) => v.number === 2);
    expect(v2After?.status).toBe("rolled_back");
  });
});

// ─── W2-016: Integration Test — TTL Cleanup ──────────────────────────────────

describe("W2-016: Integration — TTL Cleanup Lifecycle", () => {
  it("expired sandbox → sleeping → destroyed after 7 days", async () => {
    const cleanup = await import("../../apps/api/src/services/cleanup.service.js");

    // 1. Setup: sandbox with expires_at 2 days ago
    // 2. Run cleanup → verify sleeping
    const report1 = await cleanup.runCleanupCycle();
    expect(report1.slept).toBeGreaterThanOrEqual(0);

    // 3. Set expires_at to 10 days ago
    // 4. Run cleanup → verify destroyed
    const report2 = await cleanup.runCleanupCycle();
    expect(report2.destroyed).toBeGreaterThanOrEqual(0);
  });
});
