/**
 * Wave 1 — Config & GCP Client Tests
 * Tasks: W1-001, W1-002, W1-003
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── W1-001: Config Loader ──────────────────────────────────────────────────

describe("W1-001: Config Loader", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("exports config object and Config type", async () => {
    vi.stubEnv("GCP_PROJECT_ID", "test-project");
    vi.stubEnv("GCP_REGION", "us-central1");
    vi.stubEnv("GCS_BUCKET_SNAPSHOTS", "test-bucket");
    vi.stubEnv("ARTIFACT_REGISTRY", "us-central1-docker.pkg.dev/test/sandboxes");
    vi.stubEnv("DATABASE_URL", "postgresql://test@localhost/test");
    vi.stubEnv("JWT_SECRET", "test-secret");

    const { config } = await import("../../apps/api/src/lib/config.js");
    expect(config).toBeDefined();
    expect(config.GCP_PROJECT_ID).toBe("test-project");
  });

  it("missing required vars throw a Zod validation error", async () => {
    vi.stubEnv("GCP_PROJECT_ID", "");
    // Remove required vars
    delete process.env.GCP_PROJECT_ID;
    delete process.env.DATABASE_URL;

    await expect(async () => {
      // Force re-import
      const mod = await import("../../apps/api/src/lib/config.js?t=" + Date.now());
    }).rejects.toThrow();
  });

  it("PORT coerces string to number", async () => {
    vi.stubEnv("PORT", "3000");
    vi.stubEnv("GCP_PROJECT_ID", "p");
    vi.stubEnv("GCS_BUCKET_SNAPSHOTS", "b");
    vi.stubEnv("ARTIFACT_REGISTRY", "a");
    vi.stubEnv("DATABASE_URL", "d");
    vi.stubEnv("JWT_SECRET", "j");

    const { config } = await import("../../apps/api/src/lib/config.js?t=port");
    expect(typeof config.PORT).toBe("number");
    expect(config.PORT).toBe(3000);
  });

  it('NODE_ENV only accepts "development", "production", "test"', async () => {
    vi.stubEnv("NODE_ENV", "invalid");
    vi.stubEnv("GCP_PROJECT_ID", "p");
    vi.stubEnv("GCS_BUCKET_SNAPSHOTS", "b");
    vi.stubEnv("ARTIFACT_REGISTRY", "a");
    vi.stubEnv("DATABASE_URL", "d");
    vi.stubEnv("JWT_SECRET", "j");

    await expect(async () => {
      await import("../../apps/api/src/lib/config.js?t=env");
    }).rejects.toThrow();
  });

  it("PORT defaults to 8080", async () => {
    delete process.env.PORT;
    vi.stubEnv("GCP_PROJECT_ID", "p");
    vi.stubEnv("GCS_BUCKET_SNAPSHOTS", "b");
    vi.stubEnv("ARTIFACT_REGISTRY", "a");
    vi.stubEnv("DATABASE_URL", "d");
    vi.stubEnv("JWT_SECRET", "j");

    const { config } = await import("../../apps/api/src/lib/config.js?t=default");
    expect(config.PORT).toBe(8080);
  });
});

// ─── W1-002: GCP Client Initialization ──────────────────────────────────────

describe("W1-002: GCP Client Initialization", () => {
  it("exports cloudBuild client", async () => {
    const gcp = await import("../../apps/api/src/lib/gcp.js");
    expect(gcp.cloudBuild).toBeDefined();
  });

  it("exports cloudRunServices client", async () => {
    const gcp = await import("../../apps/api/src/lib/gcp.js");
    expect(gcp.cloudRunServices).toBeDefined();
  });

  it("exports cloudRunRevisions client", async () => {
    const gcp = await import("../../apps/api/src/lib/gcp.js");
    expect(gcp.cloudRunRevisions).toBeDefined();
  });

  it("exports storage client", async () => {
    const gcp = await import("../../apps/api/src/lib/gcp.js");
    expect(gcp.storage).toBeDefined();
  });

  it("getSnapshotsBucket returns a bucket handle", async () => {
    const gcp = await import("../../apps/api/src/lib/gcp.js");
    const bucket = gcp.getSnapshotsBucket();
    expect(bucket).toBeDefined();
    expect(bucket.name).toBeDefined();
  });
});

// ─── W1-003: GCP Dependencies ───────────────────────────────────────────────

describe("W1-003: GCP Dependencies installed", () => {
  it("@google-cloud/cloudbuild is importable", async () => {
    const mod = await import("@google-cloud/cloudbuild");
    expect(mod.CloudBuildClient).toBeDefined();
  });

  it("@google-cloud/run is importable", async () => {
    const mod = await import("@google-cloud/run");
    expect(mod.ServicesClient).toBeDefined();
  });

  it("@google-cloud/storage is importable", async () => {
    const mod = await import("@google-cloud/storage");
    expect(mod.Storage).toBeDefined();
  });

  it("google-auth-library is importable", async () => {
    const mod = await import("google-auth-library");
    expect(mod.GoogleAuth).toBeDefined();
  });
});
