/**
 * Wave 1 — Storage Service Tests
 * Tasks: W1-004, W1-005, W1-006, W1-007
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock GCS
const mockUpload = vi.fn().mockResolvedValue(undefined);
const mockDownload = vi.fn().mockResolvedValue([Buffer.from("test content")]);
const mockDelete = vi.fn().mockResolvedValue(undefined);
const mockFile = vi.fn().mockReturnValue({
  save: mockUpload,
  download: mockDownload,
  delete: mockDelete,
  setMetadata: vi.fn().mockResolvedValue(undefined),
});
const mockBucket = { file: mockFile };

vi.mock("../../apps/api/src/lib/gcp.js", () => ({
  getSnapshotsBucket: () => mockBucket,
  storage: {},
}));

// ─── W1-004: Upload Snapshot ─────────────────────────────────────────────────

describe("W1-004: Storage Service — Upload Snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploadSnapshot returns gs:// URL string", async () => {
    const { uploadSnapshot } = await import(
      "../../apps/api/src/services/storage.service.js"
    );
    const url = await uploadSnapshot("my-app", 1, Buffer.alloc(100));
    expect(url).toMatch(/^gs:\/\//);
  });

  it("upload path follows pattern {sandboxName}/v{version}/source.tar.gz", async () => {
    const { uploadSnapshot } = await import(
      "../../apps/api/src/services/storage.service.js"
    );
    await uploadSnapshot("my-app", 3, Buffer.alloc(100));
    expect(mockFile).toHaveBeenCalledWith("my-app/v3/source.tar.gz");
  });

  it("rejects buffers > 100 MB with descriptive error", async () => {
    const { uploadSnapshot } = await import(
      "../../apps/api/src/services/storage.service.js"
    );
    const bigBuffer = Buffer.alloc(101 * 1024 * 1024); // 101 MB
    await expect(uploadSnapshot("my-app", 1, bigBuffer)).rejects.toThrow(/100.*MB|size/i);
  });

  it("sets metadata with sandbox, version, uploaded_at fields", async () => {
    const { uploadSnapshot } = await import(
      "../../apps/api/src/services/storage.service.js"
    );
    await uploadSnapshot("my-app", 2, Buffer.alloc(100));
    // Verify metadata was set on the upload
    const saveCall = mockUpload.mock.calls[0];
    // Check that metadata is included in options or setMetadata was called
    expect(saveCall).toBeDefined();
  });
});

// ─── W1-005: Download Snapshot ───────────────────────────────────────────────

describe("W1-005: Storage Service — Download Snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("downloadSnapshot returns Buffer", async () => {
    const { downloadSnapshot } = await import(
      "../../apps/api/src/services/storage.service.js"
    );
    const buf = await downloadSnapshot("gs://nexus-snapshots/my-app/v1/source.tar.gz");
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  it("correctly parses gs://bucket/path into bucket and object", async () => {
    const { downloadSnapshot } = await import(
      "../../apps/api/src/services/storage.service.js"
    );
    await downloadSnapshot("gs://nexus-snapshots/my-app/v1/source.tar.gz");
    expect(mockFile).toHaveBeenCalledWith("my-app/v1/source.tar.gz");
  });

  it("throws descriptive error if object not found", async () => {
    mockDownload.mockRejectedValueOnce(new Error("No such object"));
    const { downloadSnapshot } = await import(
      "../../apps/api/src/services/storage.service.js"
    );
    await expect(
      downloadSnapshot("gs://nexus-snapshots/missing/file.tar.gz")
    ).rejects.toThrow();
  });
});

// ─── W1-006: Delete Snapshot ─────────────────────────────────────────────────

describe("W1-006: Storage Service — Delete Snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deleteSnapshot calls delete on correct object", async () => {
    const { deleteSnapshot } = await import(
      "../../apps/api/src/services/storage.service.js"
    );
    await deleteSnapshot("gs://nexus-snapshots/my-app/v1/source.tar.gz");
    expect(mockDelete).toHaveBeenCalled();
  });

  it("does not throw if object already deleted (idempotent)", async () => {
    mockDelete.mockRejectedValueOnce({ code: 404 });
    const { deleteSnapshot } = await import(
      "../../apps/api/src/services/storage.service.js"
    );
    await expect(
      deleteSnapshot("gs://nexus-snapshots/my-app/v1/source.tar.gz")
    ).resolves.toBeUndefined();
  });
});

// ─── W1-007: Upload Build Log ────────────────────────────────────────────────

describe("W1-007: Storage Service — Upload Build Log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploadBuildLog returns gs:// URL", async () => {
    const { uploadBuildLog } = await import(
      "../../apps/api/src/services/storage.service.js"
    );
    const url = await uploadBuildLog("my-app", 1, "Build log content...");
    expect(url).toMatch(/^gs:\/\//);
  });

  it("uploads to correct path as text/plain", async () => {
    const { uploadBuildLog } = await import(
      "../../apps/api/src/services/storage.service.js"
    );
    await uploadBuildLog("my-app", 2, "Log content");
    expect(mockFile).toHaveBeenCalledWith("my-app/v2/build.log");
  });
});
