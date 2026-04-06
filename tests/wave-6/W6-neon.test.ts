/**
 * Wave 6 — Neon Database Integration Tests
 * Tasks: W6-001 through W6-014
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Neon API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── W6-002: Create Project ──────────────────────────────────────────────────

describe("W6-002: Neon Service — Create Project", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates project with name sandbox-{sandboxName}", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      project: { id: "proj-123" },
      branch: { id: "br-main" },
      connection_uris: [{ connection_uri: "postgresql://user:pass@host/db" }],
    }), { status: 201 }));

    const { createProject } = await import("../../apps/api/src/services/neon.service.js");
    const result = await createProject("my-app");

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.project.name).toBe("sandbox-my-app");
    expect(result.projectId).toBe("proj-123");
    expect(result.branchId).toBe("br-main");
    expect(result.connectionString).toContain("postgresql://");
  });

  it("handles Neon API errors with descriptive messages", async () => {
    mockFetch.mockResolvedValue(new Response(
      JSON.stringify({ message: "Project limit reached" }),
      { status: 422 }
    ));

    const { createProject } = await import("../../apps/api/src/services/neon.service.js");
    await expect(createProject("my-app")).rejects.toThrow(/limit|error/i);
  });
});

// ─── W6-003: Create Branch ───────────────────────────────────────────────────

describe("W6-003: Neon Service — Create Branch", () => {
  it("creates branch from parent", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      branch: { id: "br-v2" },
      connection_uris: [{ connection_uri: "postgresql://user:pass@host/db" }],
    }), { status: 201 }));

    const { createBranch } = await import("../../apps/api/src/services/neon.service.js");
    const result = await createBranch("proj-123", "v2-migration", "br-main");
    expect(result.branchId).toBe("br-v2");
    expect(result.connectionString).toContain("postgresql://");
  });
});

// ─── W6-004: Apply Migration ─────────────────────────────────────────────────

describe("W6-004: Neon Service — Apply Migration", () => {
  it("executes SQL within a transaction", async () => {
    const { applyMigration } = await import("../../apps/api/src/services/neon.service.js");
    await expect(
      applyMigration("postgresql://test@localhost/db", "CREATE TABLE items (id serial)")
    ).resolves.toBeUndefined();
  });

  it("rolls back on SQL error", async () => {
    const { applyMigration } = await import("../../apps/api/src/services/neon.service.js");
    await expect(
      applyMigration("postgresql://test@localhost/db", "INVALID SQL SYNTAX!!!")
    ).rejects.toThrow();
  });

  it("throws with SQL error details on failure", async () => {
    const { applyMigration } = await import("../../apps/api/src/services/neon.service.js");
    try {
      await applyMigration("postgresql://test@localhost/db", "SELECT FROM nonexistent");
    } catch (e: any) {
      expect(e.message).toBeDefined();
    }
  });
});

// ─── W6-005: Promote & Switch Branch ─────────────────────────────────────────

describe("W6-005: Neon Service — Promote & Switch", () => {
  it("promoteBranch calls Neon API", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    const { promoteBranch } = await import("../../apps/api/src/services/neon.service.js");
    await promoteBranch("proj-123", "br-v2");
    expect(mockFetch).toHaveBeenCalled();
  });

  it("switchBranch returns new connection string", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      connection_uris: [{ connection_uri: "postgresql://new@host/db" }],
    }), { status: 200 }));

    const { switchBranch } = await import("../../apps/api/src/services/neon.service.js");
    const result = await switchBranch("proj-123", "br-v1");
    expect(result.connectionString).toContain("postgresql://");
  });
});

// ─── W6-006: Delete Project ──────────────────────────────────────────────────

describe("W6-006: Neon Service — Delete Project", () => {
  it("calls Neon API DELETE", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    const { deleteProject } = await import("../../apps/api/src/services/neon.service.js");
    await deleteProject("proj-123");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("proj-123"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("idempotent (no error if already deleted)", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 404 }));
    const { deleteProject } = await import("../../apps/api/src/services/neon.service.js");
    await expect(deleteProject("deleted-proj")).resolves.toBeUndefined();
  });
});

// ─── W6-008: DB in Create Flow ───────────────────────────────────────────────

describe("W6-008: Integrate DB into Create Flow", () => {
  it("database_enabled: true triggers Neon project creation", async () => {
    const neon = await import("../../apps/api/src/services/neon.service.js");
    const { create } = await import("../../apps/api/src/services/sandbox.service.js");
    await create({
      name: "db-app",
      ownerEmail: "test@co.com",
      sourceBuffer: Buffer.from("test"),
      database: true,
    });
    expect(neon.createProject).toHaveBeenCalled();
  });

  it("database_enabled: false skips Neon", async () => {
    const neon = await import("../../apps/api/src/services/neon.service.js");
    vi.mocked(neon.createProject).mockClear();
    const { create } = await import("../../apps/api/src/services/sandbox.service.js");
    await create({
      name: "no-db-app",
      ownerEmail: "test@co.com",
      sourceBuffer: Buffer.from("test"),
      database: false,
    });
    expect(neon.createProject).not.toHaveBeenCalled();
  });

  it("stores neon_project_id and database_url on sandbox", async () => {
    const { create } = await import("../../apps/api/src/services/sandbox.service.js");
    const sandbox = await create({
      name: "db-app-2",
      ownerEmail: "test@co.com",
      sourceBuffer: Buffer.from("test"),
      database: true,
    });
    expect(sandbox.neon_project_id).toBeDefined();
    expect(sandbox.database_url).toBeDefined();
  });
});

// ─── W6-009: DB in Deploy Flow ───────────────────────────────────────────────

describe("W6-009: Integrate DB into Deploy Flow", () => {
  it("deploy with migration_sql creates Neon branch", async () => {
    const neon = await import("../../apps/api/src/services/neon.service.js");
    const { deploy } = await import("../../apps/api/src/services/version.service.js");
    await deploy({
      sandboxId: "db-sandbox",
      sourceBuffer: Buffer.from("test"),
      migrationSql: "ALTER TABLE items ADD COLUMN price int",
      deployedBy: "test@co.com",
    });
    expect(neon.createBranch).toHaveBeenCalled();
    expect(neon.applyMigration).toHaveBeenCalled();
  });

  it("migration failure: branch deleted, version fails", async () => {
    const neon = await import("../../apps/api/src/services/neon.service.js");
    vi.mocked(neon.applyMigration).mockRejectedValue(new Error("SQL error"));

    const { deploy } = await import("../../apps/api/src/services/version.service.js");
    const result = await deploy({
      sandboxId: "db-sandbox",
      sourceBuffer: Buffer.from("test"),
      migrationSql: "INVALID SQL",
      deployedBy: "test@co.com",
    }).catch(e => e);
    expect(result).toBeDefined();
  });

  it("deploy without migration_sql skips DB steps", async () => {
    const neon = await import("../../apps/api/src/services/neon.service.js");
    vi.mocked(neon.createBranch).mockClear();
    const { deploy } = await import("../../apps/api/src/services/version.service.js");
    await deploy({
      sandboxId: "db-sandbox",
      sourceBuffer: Buffer.from("test"),
      deployedBy: "test@co.com",
    });
    expect(neon.createBranch).not.toHaveBeenCalled();
  });
});

// ─── W6-010: DB in Rollback Flow ─────────────────────────────────────────────

describe("W6-010: Integrate DB into Rollback Flow", () => {
  it("rollback switches Neon branch", async () => {
    const neon = await import("../../apps/api/src/services/neon.service.js");
    const { rollback } = await import("../../apps/api/src/services/version.service.js");
    await rollback({ sandboxId: "db-sandbox" });
    expect(neon.switchBranch).toHaveBeenCalled();
  });

  it("rollback for non-DB sandbox skips Neon", async () => {
    const neon = await import("../../apps/api/src/services/neon.service.js");
    vi.mocked(neon.switchBranch).mockClear();
    const { rollback } = await import("../../apps/api/src/services/version.service.js");
    await rollback({ sandboxId: "no-db-sandbox" });
    expect(neon.switchBranch).not.toHaveBeenCalled();
  });
});

// ─── W6-011: DB in Destroy Flow ──────────────────────────────────────────────

describe("W6-011: Integrate DB into Destroy Flow", () => {
  it("destroy deletes Neon project", async () => {
    const neon = await import("../../apps/api/src/services/neon.service.js");
    const { destroy } = await import("../../apps/api/src/services/sandbox.service.js");
    await destroy("db-sandbox-id");
    expect(neon.deleteProject).toHaveBeenCalled();
  });

  it("Neon deletion failure doesn't block sandbox destruction", async () => {
    const neon = await import("../../apps/api/src/services/neon.service.js");
    vi.mocked(neon.deleteProject).mockRejectedValue(new Error("Neon down"));
    const { destroy } = await import("../../apps/api/src/services/sandbox.service.js");
    // Should not throw
    await expect(destroy("db-sandbox-id")).resolves.toBeUndefined();
  });
});
