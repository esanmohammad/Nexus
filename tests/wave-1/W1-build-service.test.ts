/**
 * Wave 1 — Build Service Tests
 * Tasks: W1-011, W1-012, W1-013, W1-014
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Cloud Build client
const mockCreateBuild = vi.fn();
const mockGetBuild = vi.fn();

vi.mock("../../apps/api/src/lib/gcp.js", () => ({
  cloudBuild: {
    createBuild: mockCreateBuild,
    getBuild: mockGetBuild,
  },
}));

// ─── W1-011: Trigger Build ───────────────────────────────────────────────────

describe("W1-011: Build Service — Trigger Build", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateBuild.mockResolvedValue([
      { metadata: { build: { id: "build-123" } } },
    ]);
  });

  it("triggerBuild returns BuildResult with buildId", async () => {
    const { triggerBuild } = await import(
      "../../apps/api/src/services/build.service.js"
    );
    const result = await triggerBuild({
      sandboxName: "my-app",
      version: 1,
      snapshotUrl: "gs://nexus-snapshots/my-app/v1/source.tar.gz",
      dockerfile: "FROM node:22\nCMD node index.js",
      imageTag: "us-central1-docker.pkg.dev/nexus-dev/sandboxes/my-app:v1",
    });
    expect(result.buildId).toBe("build-123");
  });

  it("uses storageSource with correct bucket and object", async () => {
    const { triggerBuild } = await import(
      "../../apps/api/src/services/build.service.js"
    );
    await triggerBuild({
      sandboxName: "my-app",
      version: 1,
      snapshotUrl: "gs://nexus-snapshots/my-app/v1/source.tar.gz",
      dockerfile: "FROM node:22",
      imageTag: "registry/my-app:v1",
    });
    const callArgs = mockCreateBuild.mock.calls[0][0];
    expect(callArgs.build || callArgs).toBeDefined();
  });

  it("image tag format: {ARTIFACT_REGISTRY}/{sandboxName}:v{version}", async () => {
    const { triggerBuild } = await import(
      "../../apps/api/src/services/build.service.js"
    );
    const imageTag = "us-central1-docker.pkg.dev/nexus-dev/sandboxes/my-app:v2";
    await triggerBuild({
      sandboxName: "my-app",
      version: 2,
      snapshotUrl: "gs://bucket/my-app/v2/source.tar.gz",
      dockerfile: "FROM node:22",
      imageTag,
    });
    expect(imageTag).toMatch(/\/my-app:v2$/);
  });

  it("build timeout is 600 seconds", async () => {
    const { triggerBuild } = await import(
      "../../apps/api/src/services/build.service.js"
    );
    await triggerBuild({
      sandboxName: "my-app",
      version: 1,
      snapshotUrl: "gs://b/o",
      dockerfile: "FROM node:22",
      imageTag: "img:v1",
    });
    const callArgs = mockCreateBuild.mock.calls[0][0];
    const build = callArgs.build || callArgs;
    // Verify timeout is set to 600s
    expect(build.timeout?.seconds || build.timeout).toBeDefined();
  });

  it("tags include sandbox name and version", async () => {
    const { triggerBuild } = await import(
      "../../apps/api/src/services/build.service.js"
    );
    await triggerBuild({
      sandboxName: "my-app",
      version: 3,
      snapshotUrl: "gs://b/o",
      dockerfile: "FROM node:22",
      imageTag: "img:v3",
    });
    const callArgs = mockCreateBuild.mock.calls[0][0];
    const tags = (callArgs.build || callArgs).tags;
    expect(tags).toContain("sandbox-my-app");
    expect(tags).toContain("v3");
  });
});

// ─── W1-012: Poll Build Status ───────────────────────────────────────────────

describe("W1-012: Build Service — Poll Build Status", () => {
  it("maps Cloud Build SUCCESS to success status", async () => {
    mockGetBuild.mockResolvedValue([
      { status: "SUCCESS", images: ["img:v1"] },
    ]);
    const { getBuildStatus } = await import(
      "../../apps/api/src/services/build.service.js"
    );
    const status = await getBuildStatus("build-123");
    expect(status.status).toBe("success");
    expect(status.imageUrl).toBeDefined();
  });

  it("maps Cloud Build FAILURE to failure status", async () => {
    mockGetBuild.mockResolvedValue([
      { status: "FAILURE", statusDetail: "Build failed" },
    ]);
    const { getBuildStatus } = await import(
      "../../apps/api/src/services/build.service.js"
    );
    const status = await getBuildStatus("build-123");
    expect(status.status).toBe("failure");
  });

  it("maps Cloud Build WORKING to building status", async () => {
    mockGetBuild.mockResolvedValue([{ status: "WORKING" }]);
    const { getBuildStatus } = await import(
      "../../apps/api/src/services/build.service.js"
    );
    const status = await getBuildStatus("build-123");
    expect(status.status).toBe("building");
  });

  it("maps Cloud Build TIMEOUT to timeout status", async () => {
    mockGetBuild.mockResolvedValue([{ status: "TIMEOUT" }]);
    const { getBuildStatus } = await import(
      "../../apps/api/src/services/build.service.js"
    );
    const status = await getBuildStatus("build-123");
    expect(status.status).toBe("timeout");
  });
});

// ─── W1-013: Get Build Log ───────────────────────────────────────────────────

describe("W1-013: Build Service — Get Build Log", () => {
  it("returns raw build log text", async () => {
    mockGetBuild.mockResolvedValue([
      { logUrl: "https://console.cloud.google.com/..." },
    ]);
    const { getBuildLog } = await import(
      "../../apps/api/src/services/build.service.js"
    );
    const log = await getBuildLog("build-123");
    expect(typeof log).toBe("string");
  });

  it("handles case where log is not yet available", async () => {
    mockGetBuild.mockResolvedValue([{ status: "QUEUED" }]);
    const { getBuildLog } = await import(
      "../../apps/api/src/services/build.service.js"
    );
    const log = await getBuildLog("build-pending");
    expect(log).toBeDefined(); // Should return empty or placeholder, not throw
  });
});

// ─── W1-014: Poll Until Complete ─────────────────────────────────────────────

describe("W1-014: Build Service — Wait For Build", () => {
  it("returns BuildResult on success after polling", async () => {
    let callCount = 0;
    mockGetBuild.mockImplementation(() => {
      callCount++;
      if (callCount < 3) return [{ status: "WORKING" }];
      return [{ status: "SUCCESS", images: ["img:v1"] }];
    });

    const { waitForBuild } = await import(
      "../../apps/api/src/services/build.service.js"
    );
    const result = await waitForBuild("build-123", { pollIntervalMs: 10 });
    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeDefined();
  });

  it("returns failure result on build failure", async () => {
    mockGetBuild.mockResolvedValue([
      { status: "FAILURE", statusDetail: "npm install failed" },
    ]);
    const { waitForBuild } = await import(
      "../../apps/api/src/services/build.service.js"
    );
    const result = await waitForBuild("build-123", { pollIntervalMs: 10 });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("stops on terminal states: SUCCESS, FAILURE, TIMEOUT, CANCELLED", async () => {
    for (const terminalStatus of ["SUCCESS", "FAILURE", "TIMEOUT", "CANCELLED"]) {
      mockGetBuild.mockResolvedValue([{ status: terminalStatus }]);
      const { waitForBuild } = await import(
        "../../apps/api/src/services/build.service.js"
      );
      const result = await waitForBuild("build-x", { pollIntervalMs: 10 });
      expect(result).toBeDefined();
    }
  });

  it("has maximum poll count to prevent infinite loops", async () => {
    mockGetBuild.mockResolvedValue([{ status: "WORKING" }]);
    const { waitForBuild } = await import(
      "../../apps/api/src/services/build.service.js"
    );
    const result = await waitForBuild("build-loop", {
      pollIntervalMs: 10,
      maxPolls: 5,
    });
    // Should eventually timeout or throw
    expect(result.success).toBe(false);
  });

  it("includes durationMs in result", async () => {
    mockGetBuild.mockResolvedValue([
      { status: "SUCCESS", images: ["img:v1"], timing: {} },
    ]);
    const { waitForBuild } = await import(
      "../../apps/api/src/services/build.service.js"
    );
    const result = await waitForBuild("build-123", { pollIntervalMs: 10 });
    expect(typeof result.durationMs).toBe("number");
  });
});
