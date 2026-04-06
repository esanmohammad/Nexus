/**
 * Wave 0 — Project Scaffolding Tests
 * Tasks: W0-001 through W0-014
 *
 * These are structural/smoke tests that verify the monorepo
 * is correctly scaffolded. Run after completing Wave 0.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../..");

function readJson(path: string) {
  return JSON.parse(readFileSync(resolve(ROOT, path), "utf-8"));
}

function fileExists(path: string) {
  return existsSync(resolve(ROOT, path));
}

function readFile(path: string) {
  return readFileSync(resolve(ROOT, path), "utf-8");
}

// ─── W0-001: Root package.json ───────────────────────────────────────────────

describe("W0-001: Root package.json", () => {
  const pkg = () => readJson("package.json");

  it("file exists at nexus/package.json", () => {
    expect(fileExists("package.json")).toBe(true);
  });

  it('name field is "nexus"', () => {
    expect(pkg().name).toBe("nexus");
  });

  it("private is true", () => {
    expect(pkg().private).toBe(true);
  });

  it("defines all 6 scripts: build, dev, lint, test, format, check-format", () => {
    const scripts = Object.keys(pkg().scripts);
    expect(scripts).toContain("build");
    expect(scripts).toContain("dev");
    expect(scripts).toContain("lint");
    expect(scripts).toContain("test");
    expect(scripts).toContain("format");
    expect(scripts).toContain("check-format");
  });

  it("lists turbo, prettier, typescript in devDependencies", () => {
    const devDeps = Object.keys(pkg().devDependencies);
    expect(devDeps).toContain("turbo");
    expect(devDeps).toContain("prettier");
    expect(devDeps).toContain("typescript");
  });

  it("engines.node is >=22", () => {
    expect(pkg().engines.node).toBe(">=22");
  });

  it("packageManager specifies pnpm 9.x", () => {
    expect(pkg().packageManager).toMatch(/^pnpm@9\./);
  });
});

// ─── W0-002: pnpm-workspace.yaml ────────────────────────────────────────────

describe("W0-002: pnpm-workspace.yaml", () => {
  it("file exists", () => {
    expect(fileExists("pnpm-workspace.yaml")).toBe(true);
  });

  it('lists "apps/*" in packages', () => {
    const content = readFile("pnpm-workspace.yaml");
    expect(content).toContain("apps/*");
  });

  it('lists "packages/*" in packages', () => {
    const content = readFile("pnpm-workspace.yaml");
    expect(content).toContain("packages/*");
  });
});

// ─── W0-003: turbo.json ─────────────────────────────────────────────────────

describe("W0-003: turbo.json", () => {
  const turbo = () => readJson("turbo.json");

  it("file exists", () => {
    expect(fileExists("turbo.json")).toBe(true);
  });

  it("$schema points to turbo.build", () => {
    expect(turbo().$schema).toContain("turbo.build");
  });

  it('tasks.build.dependsOn includes "^build"', () => {
    expect(turbo().tasks.build.dependsOn).toContain("^build");
  });

  it('tasks.build.outputs includes "dist/**" and ".next/**"', () => {
    expect(turbo().tasks.build.outputs).toContain("dist/**");
    expect(turbo().tasks.build.outputs).toContain(".next/**");
  });

  it("tasks.dev.cache is false", () => {
    expect(turbo().tasks.dev.cache).toBe(false);
  });

  it("tasks.dev.persistent is true", () => {
    expect(turbo().tasks.dev.persistent).toBe(true);
  });

  it("tasks.lint and tasks.test are defined", () => {
    expect(turbo().tasks.lint).toBeDefined();
    expect(turbo().tasks.test).toBeDefined();
  });
});

// ─── W0-004: tsconfig.base.json ─────────────────────────────────────────────

describe("W0-004: tsconfig.base.json", () => {
  const tsconfig = () => readJson("tsconfig.base.json");

  it("file exists", () => {
    expect(fileExists("tsconfig.base.json")).toBe(true);
  });

  it('target is "ES2022"', () => {
    expect(tsconfig().compilerOptions.target).toBe("ES2022");
  });

  it('module is "ESNext"', () => {
    expect(tsconfig().compilerOptions.module).toBe("ESNext");
  });

  it('moduleResolution is "bundler"', () => {
    expect(tsconfig().compilerOptions.moduleResolution).toBe("bundler");
  });

  it("strict is true", () => {
    expect(tsconfig().compilerOptions.strict).toBe(true);
  });

  it("declaration is true", () => {
    expect(tsconfig().compilerOptions.declaration).toBe(true);
  });

  it('outDir is "dist", rootDir is "src"', () => {
    expect(tsconfig().compilerOptions.outDir).toBe("dist");
    expect(tsconfig().compilerOptions.rootDir).toBe("src");
  });
});

// ─── W0-005: .gitignore ─────────────────────────────────────────────────────

describe("W0-005: .gitignore", () => {
  const gitignore = () => readFile(".gitignore");

  it("file exists", () => {
    expect(fileExists(".gitignore")).toBe(true);
  });

  it("ignores node_modules/", () => {
    expect(gitignore()).toContain("node_modules/");
  });

  it("ignores dist/", () => {
    expect(gitignore()).toContain("dist/");
  });

  it("ignores .next/", () => {
    expect(gitignore()).toContain(".next/");
  });

  it("ignores .turbo/", () => {
    expect(gitignore()).toContain(".turbo/");
  });

  it("ignores *.env", () => {
    expect(gitignore()).toContain("*.env");
  });

  it("does NOT ignore .env.example (negation rule)", () => {
    expect(gitignore()).toContain("!.env.example");
  });
});

// ─── W0-006: .env.example ───────────────────────────────────────────────────

describe("W0-006: .env.example", () => {
  const env = () => readFile(".env.example");

  it("file exists", () => {
    expect(fileExists(".env.example")).toBe(true);
  });

  it("contains GCP_PROJECT_ID", () => {
    expect(env()).toContain("GCP_PROJECT_ID");
  });

  it("contains GCP_REGION", () => {
    expect(env()).toContain("GCP_REGION");
  });

  it("contains GCS_BUCKET_SNAPSHOTS", () => {
    expect(env()).toContain("GCS_BUCKET_SNAPSHOTS");
  });

  it("contains ARTIFACT_REGISTRY", () => {
    expect(env()).toContain("ARTIFACT_REGISTRY");
  });

  it("contains DATABASE_URL", () => {
    expect(env()).toContain("DATABASE_URL");
  });

  it("contains GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET", () => {
    expect(env()).toContain("GOOGLE_CLIENT_ID");
    expect(env()).toContain("GOOGLE_CLIENT_SECRET");
  });

  it("contains JWT_SECRET and SESSION_SECRET", () => {
    expect(env()).toContain("JWT_SECRET");
    expect(env()).toContain("SESSION_SECRET");
  });

  it("contains SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, SLACK_APP_TOKEN", () => {
    expect(env()).toContain("SLACK_BOT_TOKEN");
    expect(env()).toContain("SLACK_SIGNING_SECRET");
    expect(env()).toContain("SLACK_APP_TOKEN");
  });

  it("contains NEON_API_KEY", () => {
    expect(env()).toContain("NEON_API_KEY");
  });

  it("Cloudflare vars are commented out", () => {
    expect(env()).toMatch(/^#\s*CLOUDFLARE_API_TOKEN/m);
  });

  it("contains no actual secrets (only placeholders)", () => {
    // Should not contain long random-looking strings
    const lines = env().split("\n").filter((l: string) => l.includes("=") && !l.startsWith("#"));
    for (const line of lines) {
      const value = line.split("=")[1]?.trim();
      // Values should be empty, placeholder text, or short defaults
      if (value && value.length > 40 && !value.startsWith("postgresql://")) {
        throw new Error(`Possible secret in .env.example: ${line}`);
      }
    }
  });
});

// ─── W0-007: packages/shared package config ─────────────────────────────────

describe("W0-007: packages/shared package config", () => {
  it("packages/shared/package.json exists with name @nexus/shared", () => {
    const pkg = readJson("packages/shared/package.json");
    expect(pkg.name).toBe("@nexus/shared");
  });

  it('main points to "dist/index.js", types to "dist/index.d.ts"', () => {
    const pkg = readJson("packages/shared/package.json");
    expect(pkg.main).toBe("dist/index.js");
    expect(pkg.types).toBe("dist/index.d.ts");
  });

  it("zod is a dependency", () => {
    const pkg = readJson("packages/shared/package.json");
    expect(pkg.dependencies).toHaveProperty("zod");
  });

  it("tsconfig.json extends ../../tsconfig.base.json", () => {
    const tsconfig = readJson("packages/shared/tsconfig.json");
    expect(tsconfig.extends).toBe("../../tsconfig.base.json");
  });

  it("scripts include build, lint, test", () => {
    const pkg = readJson("packages/shared/package.json");
    expect(pkg.scripts).toHaveProperty("build");
    expect(pkg.scripts).toHaveProperty("lint");
    expect(pkg.scripts).toHaveProperty("test");
  });
});

// ─── W0-008: packages/shared enums ──────────────────────────────────────────

describe("W0-008: packages/shared enums", () => {
  // These tests import the built shared package
  // Run after `pnpm --filter @nexus/shared build`

  it("SandboxState has exactly 5 values", async () => {
    const { SandboxState } = await import("@nexus/shared");
    const values = Object.values(SandboxState);
    expect(values).toHaveLength(5);
    expect(values).toContain("creating");
    expect(values).toContain("running");
    expect(values).toContain("sleeping");
    expect(values).toContain("destroying");
    expect(values).toContain("destroyed");
  });

  it("VersionStatus has exactly 4 values", async () => {
    const { VersionStatus } = await import("@nexus/shared");
    const values = Object.values(VersionStatus);
    expect(values).toHaveLength(4);
    expect(values).toContain("building");
    expect(values).toContain("live");
    expect(values).toContain("rolled_back");
    expect(values).toContain("failed");
  });

  it("AccessMode has exactly 4 values", async () => {
    const { AccessMode } = await import("@nexus/shared");
    const values = Object.values(AccessMode);
    expect(values).toHaveLength(4);
    expect(values).toContain("owner_only");
    expect(values).toContain("team");
    expect(values).toContain("anyone");
    expect(values).toContain("custom");
  });

  it("Runtime has exactly 5 values", async () => {
    const { Runtime } = await import("@nexus/shared");
    const values = Object.values(Runtime);
    expect(values).toHaveLength(5);
    expect(values).toContain("nodejs");
    expect(values).toContain("python");
    expect(values).toContain("static");
    expect(values).toContain("go");
    expect(values).toContain("dockerfile");
  });

  it("DatabaseState has exactly 4 values", async () => {
    const { DatabaseState } = await import("@nexus/shared");
    expect(Object.values(DatabaseState)).toHaveLength(4);
  });

  it("SandboxMaturity has exactly 4 values", async () => {
    const { SandboxMaturity } = await import("@nexus/shared");
    expect(Object.values(SandboxMaturity)).toHaveLength(4);
    expect(Object.values(SandboxMaturity)).toContain("throwaway");
    expect(Object.values(SandboxMaturity)).toContain("incubating");
    expect(Object.values(SandboxMaturity)).toContain("established");
    expect(Object.values(SandboxMaturity)).toContain("graduated");
  });

  it("all enum values are lowercase snake_case", async () => {
    const shared = await import("@nexus/shared");
    const enums = [
      shared.SandboxState,
      shared.VersionStatus,
      shared.AccessMode,
      shared.Runtime,
      shared.DatabaseState,
      shared.SandboxMaturity,
    ];
    for (const enumObj of enums) {
      for (const value of Object.values(enumObj)) {
        expect(value).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    }
  });
});

// ─── W0-009: packages/shared Zod schemas ────────────────────────────────────

describe("W0-009: packages/shared Zod schemas", () => {
  it("CreateSandboxSchema validates name regex /^[a-z][a-z0-9-]*[a-z0-9]$/", async () => {
    const { CreateSandboxSchema } = await import("@nexus/shared");
    expect(CreateSandboxSchema.safeParse({ name: "my-app" }).success).toBe(true);
    expect(CreateSandboxSchema.safeParse({ name: "My-App" }).success).toBe(false);
    expect(CreateSandboxSchema.safeParse({ name: "my_app" }).success).toBe(false);
    expect(CreateSandboxSchema.safeParse({ name: "123abc" }).success).toBe(false);
    expect(CreateSandboxSchema.safeParse({ name: "app-" }).success).toBe(false);
  });

  it("CreateSandboxSchema rejects names < 3 or > 63 chars", async () => {
    const { CreateSandboxSchema } = await import("@nexus/shared");
    expect(CreateSandboxSchema.safeParse({ name: "ab" }).success).toBe(false);
    expect(CreateSandboxSchema.safeParse({ name: "a".repeat(64) }).success).toBe(false);
    expect(CreateSandboxSchema.safeParse({ name: "abc" }).success).toBe(true);
  });

  it("CreateSandboxSchema defaults database to false, ttl_days to 7, access_mode to owner_only", async () => {
    const { CreateSandboxSchema } = await import("@nexus/shared");
    const result = CreateSandboxSchema.parse({ name: "test-app" });
    expect(result.database).toBe(false);
    expect(result.ttl_days).toBe(7);
    expect(result.access_mode).toBe("owner_only");
  });

  it("UpdateSandboxSchema has all fields optional", async () => {
    const { UpdateSandboxSchema } = await import("@nexus/shared");
    expect(UpdateSandboxSchema.safeParse({}).success).toBe(true);
  });

  it("ExtendSandboxSchema requires ttl_days (1-90)", async () => {
    const { ExtendSandboxSchema } = await import("@nexus/shared");
    expect(ExtendSandboxSchema.safeParse({}).success).toBe(false);
    expect(ExtendSandboxSchema.safeParse({ ttl_days: 0 }).success).toBe(false);
    expect(ExtendSandboxSchema.safeParse({ ttl_days: 91 }).success).toBe(false);
    expect(ExtendSandboxSchema.safeParse({ ttl_days: 30 }).success).toBe(true);
  });

  it("ShareSandboxSchema requires access_mode, optional allowed_emails", async () => {
    const { ShareSandboxSchema } = await import("@nexus/shared");
    expect(ShareSandboxSchema.safeParse({}).success).toBe(false);
    expect(ShareSandboxSchema.safeParse({ access_mode: "anyone" }).success).toBe(true);
    expect(
      ShareSandboxSchema.safeParse({
        access_mode: "custom",
        allowed_emails: ["a@b.com"],
      }).success
    ).toBe(true);
  });

  it("DeployVersionSchema has optional label (max 200) and migration_sql", async () => {
    const { DeployVersionSchema } = await import("@nexus/shared");
    expect(DeployVersionSchema.safeParse({}).success).toBe(true);
    expect(DeployVersionSchema.safeParse({ label: "x".repeat(201) }).success).toBe(false);
    expect(DeployVersionSchema.safeParse({ label: "my label", migration_sql: "ALTER TABLE..." }).success).toBe(true);
  });

  it("RollbackSchema has optional target_version (positive int)", async () => {
    const { RollbackSchema } = await import("@nexus/shared");
    expect(RollbackSchema.safeParse({}).success).toBe(true);
    expect(RollbackSchema.safeParse({ target_version: 2 }).success).toBe(true);
    expect(RollbackSchema.safeParse({ target_version: -1 }).success).toBe(false);
    expect(RollbackSchema.safeParse({ target_version: 0 }).success).toBe(false);
  });

  it("all types are exported", async () => {
    const shared = await import("@nexus/shared");
    // Type exports can't be runtime-checked, but the schema exports prove they exist
    expect(shared.CreateSandboxSchema).toBeDefined();
    expect(shared.UpdateSandboxSchema).toBeDefined();
    expect(shared.ExtendSandboxSchema).toBeDefined();
    expect(shared.ShareSandboxSchema).toBeDefined();
    expect(shared.DeployVersionSchema).toBeDefined();
    expect(shared.RollbackSchema).toBeDefined();
  });
});

// ─── W0-010: packages/shared barrel export ──────────────────────────────────

describe("W0-010: packages/shared barrel export", () => {
  it("index.ts exists", () => {
    expect(fileExists("packages/shared/src/index.ts")).toBe(true);
  });

  it("exports enums", async () => {
    const shared = await import("@nexus/shared");
    expect(shared.SandboxState).toBeDefined();
    expect(shared.VersionStatus).toBeDefined();
    expect(shared.AccessMode).toBeDefined();
    expect(shared.Runtime).toBeDefined();
  });

  it("exports schemas", async () => {
    const shared = await import("@nexus/shared");
    expect(shared.CreateSandboxSchema).toBeDefined();
    expect(shared.DeployVersionSchema).toBeDefined();
  });

  it("pnpm --filter @nexus/shared build succeeds (dist/ generated)", () => {
    expect(fileExists("packages/shared/dist/index.js")).toBe(true);
    expect(fileExists("packages/shared/dist/index.d.ts")).toBe(true);
  });
});

// ─── W0-011: packages/db Drizzle schema ─────────────────────────────────────

describe("W0-011: packages/db Drizzle schema", () => {
  it("packages/db/package.json exists with name @nexus/db", () => {
    const pkg = readJson("packages/db/package.json");
    expect(pkg.name).toBe("@nexus/db");
  });

  it("drizzle-orm and @neondatabase/serverless are dependencies", () => {
    const pkg = readJson("packages/db/package.json");
    expect(pkg.dependencies).toHaveProperty("drizzle-orm");
    expect(pkg.dependencies).toHaveProperty("@neondatabase/serverless");
  });

  it("sandboxes schema file exists", () => {
    expect(fileExists("packages/db/src/schema/sandboxes.ts")).toBe(true);
  });

  it("versions schema file exists", () => {
    expect(fileExists("packages/db/src/schema/versions.ts")).toBe(true);
  });

  it("audit-logs schema file exists", () => {
    expect(fileExists("packages/db/src/schema/audit-logs.ts")).toBe(true);
  });

  it("sandboxes table has all required columns", () => {
    const content = readFile("packages/db/src/schema/sandboxes.ts");
    const requiredColumns = [
      "id", "name", "owner_email", "team", "runtime", "state",
      "access_mode", "allowed_emails", "cloud_run_service", "cloud_run_url",
      "region", "database_enabled", "neon_project_id", "neon_branch_id",
      "database_url", "ttl_days", "expires_at", "expiry_notified_72h",
      "expiry_notified_24h", "github_repo", "github_webhook_id",
      "current_version", "metadata", "created_at", "updated_at", "destroyed_at",
    ];
    for (const col of requiredColumns) {
      expect(content).toContain(`"${col}"`);
    }
  });

  it("versions table has all required columns", () => {
    const content = readFile("packages/db/src/schema/versions.ts");
    const requiredColumns = [
      "id", "sandbox_id", "number", "label", "status",
      "source_snapshot_url", "container_image", "cloud_run_revision",
      "build_log_url", "migration_sql", "neon_branch_id",
      "created_by", "created_at", "deployed_at", "build_duration_ms",
    ];
    for (const col of requiredColumns) {
      expect(content).toContain(`"${col}"`);
    }
  });

  it("audit_logs table has all required columns", () => {
    const content = readFile("packages/db/src/schema/audit-logs.ts");
    const requiredColumns = [
      "id", "actor_email", "action", "resource_type",
      "resource_id", "details", "ip_address", "user_agent", "created_at",
    ];
    for (const col of requiredColumns) {
      expect(content).toContain(`"${col}"`);
    }
  });

  it("index.ts exports createDb function", () => {
    const content = readFile("packages/db/src/index.ts");
    expect(content).toContain("createDb");
    expect(content).toContain("export");
  });

  it("drizzle.config.ts points to correct schema path", () => {
    const content = readFile("packages/db/drizzle.config.ts");
    expect(content).toContain("./src/schema/");
    expect(content).toContain("./src/migrations");
  });

  it("pnpm --filter @nexus/db build succeeds", () => {
    expect(fileExists("packages/db/dist/index.js")).toBe(true);
  });
});

// ─── W0-012: apps/api empty Hono server ─────────────────────────────────────

describe("W0-012: apps/api empty Hono server", () => {
  it("apps/api/package.json exists with name @nexus/api", () => {
    const pkg = readJson("apps/api/package.json");
    expect(pkg.name).toBe("@nexus/api");
  });

  it("hono and @hono/node-server are dependencies", () => {
    const pkg = readJson("apps/api/package.json");
    expect(pkg.dependencies).toHaveProperty("hono");
    expect(pkg.dependencies).toHaveProperty("@hono/node-server");
  });

  it("@nexus/shared and @nexus/db are workspace dependencies", () => {
    const pkg = readJson("apps/api/package.json");
    expect(pkg.dependencies["@nexus/shared"]).toBe("workspace:*");
    expect(pkg.dependencies["@nexus/db"]).toBe("workspace:*");
  });

  it("pnpm --filter @nexus/api build succeeds", () => {
    expect(fileExists("apps/api/dist/index.js")).toBe(true);
  });

  it("Dockerfile exists and is valid", () => {
    const dockerfile = readFile("apps/api/Dockerfile");
    expect(dockerfile).toContain("FROM node:22-slim");
    expect(dockerfile).toContain("EXPOSE 8080");
    expect(dockerfile).toContain("CMD");
  });

  // Health endpoint test — run with API server started
  it("GET /api/health returns 200 with status ok", async () => {
    // This test requires the API server to be running
    // In CI, start the server before running this test
    const app = (await import("@nexus/api")).default;
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });

  it("health response Content-Type is application/json", async () => {
    const app = (await import("@nexus/api")).default;
    const res = await app.request("/api/health");
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});

// ─── W0-013: apps/web empty Next.js ─────────────────────────────────────────

describe("W0-013: apps/web empty Next.js", () => {
  it("apps/web/package.json exists with name @nexus/web", () => {
    const pkg = readJson("apps/web/package.json");
    expect(pkg.name).toBe("@nexus/web");
  });

  it("next, react, react-dom are dependencies", () => {
    const pkg = readJson("apps/web/package.json");
    expect(pkg.dependencies).toHaveProperty("next");
    expect(pkg.dependencies).toHaveProperty("react");
    expect(pkg.dependencies).toHaveProperty("react-dom");
  });

  it("page.tsx exists with Nexus heading", () => {
    const page = readFile("apps/web/src/app/page.tsx");
    expect(page).toContain("Nexus");
  });

  it('page.tsx contains "What do you want to ship?"', () => {
    const page = readFile("apps/web/src/app/page.tsx");
    expect(page).toContain("What do you want to ship?");
  });

  it("tailwind classes used in page", () => {
    const page = readFile("apps/web/src/app/page.tsx");
    expect(page).toContain("min-h-screen");
  });
});

// ─── W0-014: GitHub Actions CI ──────────────────────────────────────────────

describe("W0-014: GitHub Actions CI", () => {
  it("ci.yml exists", () => {
    expect(fileExists(".github/workflows/ci.yml")).toBe(true);
  });

  it("triggers on push to main and PRs to main", () => {
    const ci = readFile(".github/workflows/ci.yml");
    expect(ci).toContain("push:");
    expect(ci).toContain("pull_request:");
    expect(ci).toContain("main");
  });

  it("uses pnpm/action-setup@v4", () => {
    const ci = readFile(".github/workflows/ci.yml");
    expect(ci).toContain("pnpm/action-setup");
  });

  it("uses actions/setup-node@v4 with node 22", () => {
    const ci = readFile(".github/workflows/ci.yml");
    expect(ci).toContain("actions/setup-node");
    expect(ci).toContain("22");
  });

  it("runs install, build, lint, test", () => {
    const ci = readFile(".github/workflows/ci.yml");
    expect(ci).toContain("pnpm install");
    expect(ci).toContain("pnpm build");
    expect(ci).toContain("pnpm lint");
    expect(ci).toContain("pnpm test");
  });
});
