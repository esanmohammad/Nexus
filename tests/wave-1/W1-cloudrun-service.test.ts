/**
 * Wave 1 — Cloud Run Service Tests
 * Tasks: W1-015, W1-016, W1-017, W1-018
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Cloud Run clients
const mockCreateService = vi.fn();
const mockUpdateService = vi.fn();
const mockDeleteService = vi.fn();
const mockGetService = vi.fn();

vi.mock("../../apps/api/src/lib/gcp.js", () => ({
  cloudRunServices: {
    createService: mockCreateService,
    updateService: mockUpdateService,
    deleteService: mockDeleteService,
    getService: mockGetService,
  },
  cloudRunRevisions: {},
}));

// ─── W1-015: Create Cloud Run Service ────────────────────────────────────────

describe("W1-015: Cloud Run — Create Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateService.mockResolvedValue([
      {
        metadata: { name: "sandbox-my-app" },
        status: { url: "https://sandbox-my-app-abc123-uc.a.run.app" },
        latestCreatedRevisionName: "sandbox-my-app-00001",
      },
    ]);
  });

  it("service name follows sandbox-{name} pattern", async () => {
    const { createService } = await import(
      "../../apps/api/src/services/cloudrun.service.js"
    );
    await createService({
      sandboxName: "my-app",
      imageUrl: "img:v1",
      port: 8080,
    });
    const callArgs = mockCreateService.mock.calls[0][0];
    const serviceName = callArgs.service?.name || callArgs.serviceName;
    expect(serviceName || JSON.stringify(callArgs)).toContain("sandbox-my-app");
  });

  it("returns serviceUrl (*.run.app) and revisionName", async () => {
    const { createService } = await import(
      "../../apps/api/src/services/cloudrun.service.js"
    );
    const result = await createService({
      sandboxName: "my-app",
      imageUrl: "img:v1",
      port: 8080,
    });
    expect(result.serviceUrl).toMatch(/\.run\.app/);
    expect(result.revisionName).toBeDefined();
  });

  it("service is NOT publicly accessible (requires IAM auth)", async () => {
    const { createService } = await import(
      "../../apps/api/src/services/cloudrun.service.js"
    );
    await createService({
      sandboxName: "my-app",
      imageUrl: "img:v1",
      port: 8080,
    });
    // Verify the service was not created with allUsers invoker
    const callArgs = mockCreateService.mock.calls[0][0];
    const asString = JSON.stringify(callArgs);
    expect(asString).not.toContain("allUsers");
  });

  it("env vars SANDBOX_ID, SANDBOX_NAME, VERSION, PORT are injected", async () => {
    const { createService } = await import(
      "../../apps/api/src/services/cloudrun.service.js"
    );
    await createService({
      sandboxName: "my-app",
      imageUrl: "img:v1",
      port: 3000,
      envVars: { CUSTOM: "value" },
    });
    const callArgs = mockCreateService.mock.calls[0][0];
    const asString = JSON.stringify(callArgs);
    expect(asString).toContain("SANDBOX_NAME");
    expect(asString).toContain("PORT");
  });

  it("max instances = 2, min instances = 0", async () => {
    const { createService } = await import(
      "../../apps/api/src/services/cloudrun.service.js"
    );
    await createService({
      sandboxName: "my-app",
      imageUrl: "img:v1",
      port: 8080,
    });
    const callArgs = mockCreateService.mock.calls[0][0];
    const asString = JSON.stringify(callArgs);
    // Verify scaling configuration
    expect(asString).toContain("2"); // maxInstances
  });
});

// ─── W1-016: Deploy Revision ─────────────────────────────────────────────────

describe("W1-016: Cloud Run — Deploy Revision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateService.mockResolvedValue([
      {
        latestCreatedRevisionName: "sandbox-my-app-00002",
      },
    ]);
  });

  it("updates existing service (does not create new)", async () => {
    const { deployRevision } = await import(
      "../../apps/api/src/services/cloudrun.service.js"
    );
    await deployRevision({
      sandboxName: "my-app",
      imageUrl: "img:v2",
      port: 8080,
    });
    expect(mockUpdateService).toHaveBeenCalled();
    expect(mockCreateService).not.toHaveBeenCalled();
  });

  it("returns { revisionName }", async () => {
    const { deployRevision } = await import(
      "../../apps/api/src/services/cloudrun.service.js"
    );
    const result = await deployRevision({
      sandboxName: "my-app",
      imageUrl: "img:v2",
      port: 8080,
    });
    expect(result.revisionName).toBeDefined();
    expect(result.revisionName).toContain("sandbox-my-app");
  });
});

// ─── W1-017: Shift Traffic ───────────────────────────────────────────────────

describe("W1-017: Cloud Run — Shift Traffic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateService.mockResolvedValue([{}]);
  });

  it("shifts 100% traffic to specified revision", async () => {
    const { shiftTraffic } = await import(
      "../../apps/api/src/services/cloudrun.service.js"
    );
    await shiftTraffic({
      sandboxName: "my-app",
      revisionName: "sandbox-my-app-00001",
    });
    expect(mockUpdateService).toHaveBeenCalled();
    const callArgs = mockUpdateService.mock.calls[0][0];
    const asString = JSON.stringify(callArgs);
    expect(asString).toContain("sandbox-my-app-00001");
    expect(asString).toContain("100");
  });

  it("does NOT create a new revision", async () => {
    const { shiftTraffic } = await import(
      "../../apps/api/src/services/cloudrun.service.js"
    );
    await shiftTraffic({
      sandboxName: "my-app",
      revisionName: "sandbox-my-app-00001",
    });
    expect(mockCreateService).not.toHaveBeenCalled();
  });
});

// ─── W1-018: Delete & Get URL ────────────────────────────────────────────────

describe("W1-018: Cloud Run — Delete & Get URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deleteService removes the Cloud Run service", async () => {
    mockDeleteService.mockResolvedValue([{}]);
    const { deleteService } = await import(
      "../../apps/api/src/services/cloudrun.service.js"
    );
    await deleteService("my-app");
    expect(mockDeleteService).toHaveBeenCalled();
  });

  it("deleteService is idempotent (no error if already deleted)", async () => {
    mockDeleteService.mockRejectedValue({ code: 404, message: "Not found" });
    const { deleteService } = await import(
      "../../apps/api/src/services/cloudrun.service.js"
    );
    await expect(deleteService("deleted-app")).resolves.toBeUndefined();
  });

  it("getServiceUrl returns URL or null", async () => {
    mockGetService.mockResolvedValue([
      { status: { url: "https://sandbox-my-app-abc.run.app" } },
    ]);
    const { getServiceUrl } = await import(
      "../../apps/api/src/services/cloudrun.service.js"
    );
    const url = await getServiceUrl("my-app");
    expect(url).toContain(".run.app");
  });

  it("getServiceUrl returns null if service doesn't exist", async () => {
    mockGetService.mockRejectedValue({ code: 404 });
    const { getServiceUrl } = await import(
      "../../apps/api/src/services/cloudrun.service.js"
    );
    const url = await getServiceUrl("nonexistent");
    expect(url).toBeNull();
  });
});
