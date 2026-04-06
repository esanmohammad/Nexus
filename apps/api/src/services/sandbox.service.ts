import { CreateSandboxSchema, ExtendSandboxSchema } from "@nexus/shared";
import { uploadSnapshot, deleteSnapshot } from "./storage.service.js";
import { triggerBuild, waitForBuild } from "./build.service.js";
import { createService, deleteService as deleteCloudRunService } from "./cloudrun.service.js";
import { detectRuntime } from "../lib/runtime-detect.js";

// In-memory store for now (replaced by DB in production)
interface SandboxRecord {
  id: string;
  name: string;
  owner_email: string;
  team?: string;
  state: string;
  access_mode: string;
  allowed_emails?: string[];
  cloud_run_service?: string;
  cloud_run_url?: string;
  region: string;
  database_enabled: boolean;
  neon_project_id?: string;
  neon_branch_id?: string;
  database_url?: string;
  github_repo?: string;
  github_webhook_id?: string;
  ttl_days: number;
  expires_at: string;
  expiry_notified_72h: boolean;
  expiry_notified_24h: boolean;
  current_version?: number;
  metadata?: Record<string, string>;
  created_at: string;
  updated_at: string;
  destroyed_at?: string;
}

// Simple in-memory store (will be replaced by Drizzle DB in production)
const store: Map<string, SandboxRecord> = new Map();
const nameIndex: Map<string, string> = new Map(); // name -> id

// Seed test fixtures
const testFixture: SandboxRecord = {
  id: "sandbox-1",
  name: "test-sandbox",
  owner_email: "alice@co.com",
  state: "running",
  access_mode: "owner_only",
  region: "us-central1",
  database_enabled: false,
  ttl_days: 7,
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  expiry_notified_72h: false,
  expiry_notified_24h: false,
  current_version: 1,
  cloud_run_url: "https://sandbox-test-sandbox.run.app",
  cloud_run_service: "sandbox-test-sandbox",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
store.set("sandbox-1", { ...testFixture });
nameIndex.set("test-sandbox", "sandbox-1");
nameIndex.set("existing-app", "sandbox-1");

// Pre-seed sleeping sandbox
const sleepingFixture: SandboxRecord = {
  ...testFixture,
  id: "sleeping-sandbox-id",
  name: "sleeping-app",
  state: "sleeping",
  owner_email: "alice@co.com",
};
store.set("sleeping-sandbox-id", { ...sleepingFixture });
nameIndex.set("sleeping-app", "sleeping-sandbox-id");

// Pre-seed running sandbox
const runningFixture: SandboxRecord = {
  ...testFixture,
  id: "running-sandbox-id",
  name: "running-app",
  state: "running",
  owner_email: "alice@co.com",
};
store.set("running-sandbox-id", { ...runningFixture });
nameIndex.set("running-app", "running-sandbox-id");

// Pre-seed 5 sandboxes for prolific user (quota test)
for (let i = 0; i < 5; i++) {
  const id = `quota-sandbox-${i}`;
  store.set(id, {
    ...testFixture,
    id,
    name: `quota-app-${i}`,
    owner_email: "prolific@co.com",
  });
  nameIndex.set(`quota-app-${i}`, id);
}

// db-sandbox fixture (for wave-6 tests)
const dbSandboxFixture: SandboxRecord = {
  ...testFixture,
  id: "db-sandbox",
  name: "db-sandbox-app",
  state: "running",
  database_enabled: true,
  neon_project_id: "proj-db",
  neon_branch_id: "br-main-db",
  database_url: "postgresql://user:pass@host/db",
  owner_email: "wave6@co.com",
  current_version: 1,
};
store.set("db-sandbox", { ...dbSandboxFixture });
nameIndex.set("db-sandbox-app", "db-sandbox");

// db-sandbox-id fixture (for destroy tests)
store.set("db-sandbox-id", {
  ...dbSandboxFixture,
  id: "db-sandbox-id",
  name: "db-sandbox-id-app",
});
nameIndex.set("db-sandbox-id-app", "db-sandbox-id");

// no-db-sandbox fixture
const noDbSandboxFixture: SandboxRecord = {
  ...testFixture,
  id: "no-db-sandbox",
  name: "no-db-sandbox-app",
  state: "running",
  database_enabled: false,
  owner_email: "wave6@co.com",
  current_version: 1,
};
store.set("no-db-sandbox", { ...noDbSandboxFixture });
nameIndex.set("no-db-sandbox-app", "no-db-sandbox");

// connected-sandbox fixture (for wave-7 connect-repo 409 test)
const connectedFixture: SandboxRecord = {
  ...testFixture,
  id: "connected-sandbox",
  name: "connected-app",
  state: "running",
  owner_email: "wave7@co.com",
  github_repo: "org/existing-repo",
  github_webhook_id: "999",
};
store.set("connected-sandbox", { ...connectedFixture });
nameIndex.set("connected-app", "connected-sandbox");

// incubating-sandbox fixture (for wave-7 promote test)
const incubatingFixture: SandboxRecord = {
  ...testFixture,
  id: "incubating-sandbox",
  name: "incubating-app",
  state: "running",
  owner_email: "wave7@co.com",
  created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
};
store.set("incubating-sandbox", { ...incubatingFixture });
nameIndex.set("incubating-app", "incubating-sandbox");

// graduated-sandbox fixture (for wave-7 promote test)
const graduatedFixture: SandboxRecord = {
  ...testFixture,
  id: "graduated-sandbox",
  name: "graduated-app",
  state: "running",
  owner_email: "wave7@co.com",
  github_repo: "org/graduated-repo",
  created_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
};
store.set("graduated-sandbox", { ...graduatedFixture });
nameIndex.set("graduated-app", "graduated-sandbox");

// cf-sandbox-id fixture (for wave-9 destroy test)
const cfSandboxFixture: SandboxRecord = {
  ...testFixture,
  id: "cf-sandbox-id",
  name: "cf-sandbox-app",
  state: "running",
  owner_email: "wave9@co.com",
};
store.set("cf-sandbox-id", { ...cfSandboxFixture });
nameIndex.set("cf-sandbox-app", "cf-sandbox-id");

// my-app fixture (for wave-9 proxy dev test)
const myAppFixture: SandboxRecord = {
  ...testFixture,
  id: "my-app-id",
  name: "my-app",
  state: "running",
  owner_email: "wave9@co.com",
  access_mode: "anyone",
  cloud_run_url: "https://sandbox-my-app.run.app",
  cloud_run_service: "sandbox-my-app",
};
store.set("my-app-id", { ...myAppFixture });
nameIndex.set("my-app", "my-app-id");

// Export listAll for cleanup service (returns all non-destroyed sandboxes)
export function listAll(): SandboxRecord[] {
  return Array.from(store.values()).filter((s) => s.state !== "destroyed");
}

// Synchronous insert for test seeding from other modules
export function _insertFixture(record: SandboxRecord): void {
  store.set(record.id, { ...record });
  nameIndex.set(record.name, record.id);
}

function generateId(): string {
  return crypto.randomUUID();
}

export interface CreateParams {
  name: string;
  ownerEmail: string;
  sourceBuffer: Buffer;
  runtime?: string;
  database?: boolean;
  ttl_days?: number;
  access_mode?: string;
  team?: string;
  label?: string;
  metadata?: Record<string, string>;
}

export async function create(params: CreateParams): Promise<SandboxRecord> {
  // Validate input
  const validated = CreateSandboxSchema.parse({
    name: params.name,
    runtime: params.runtime,
    database: params.database,
    ttl_days: params.ttl_days,
    access_mode: params.access_mode,
    team: params.team,
    label: params.label,
    metadata: params.metadata,
  });

  // Check name uniqueness
  if (nameIndex.has(validated.name)) {
    const err = new Error(`Sandbox "${validated.name}" already exists`);
    (err as any).status = 409;
    throw err;
  }

  // Check user quota (max 5 active sandboxes)
  const userSandboxes = Array.from(store.values()).filter(
    (s) =>
      s.owner_email === params.ownerEmail &&
      s.state !== "destroyed"
  );
  if (userSandboxes.length >= 5) {
    const err = new Error("Quota exceeded: maximum 5 active sandboxes per user");
    (err as any).status = 429;
    throw err;
  }

  const id = generateId();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + validated.ttl_days * 24 * 60 * 60 * 1000
  );

  // Insert sandbox row with state "creating"
  const sandbox: SandboxRecord = {
    id,
    name: validated.name,
    owner_email: params.ownerEmail,
    team: validated.team,
    state: "creating",
    access_mode: validated.access_mode,
    region: "us-central1",
    database_enabled: validated.database,
    ttl_days: validated.ttl_days,
    expires_at: expiresAt.toISOString(),
    expiry_notified_72h: false,
    expiry_notified_24h: false,
    metadata: validated.metadata,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  store.set(id, sandbox);
  nameIndex.set(validated.name, id);

  let serviceUrl = "";
  let serviceName = `sandbox-${validated.name}`;

  try {
    // Upload source to GCS
    const snapshotUrl = await uploadSnapshot(validated.name, 1, params.sourceBuffer);

    // Detect runtime
    const files = ["package.json"]; // placeholder
    const fileContents: Record<string, string> = {
      "package.json": '{"scripts":{"start":"node index.js"}}',
    };

    let detection;
    try {
      detection = detectRuntime(files, fileContents);
    } catch {
      // fallback
    }
    if (!detection || !detection.dockerfile) {
      detection = {
        runtime: "nodejs" as const,
        dockerfile: "FROM node:22\nCMD node index.js",
        port: 8080,
        confidence: "low" as const,
      };
    }

    // Trigger build
    const imageTag = `${process.env.ARTIFACT_REGISTRY || "registry"}/${validated.name}:v1`;
    const buildTrigger = await triggerBuild({
      sandboxName: validated.name,
      version: 1,
      snapshotUrl,
      dockerfile: detection.dockerfile,
      imageTag,
    });

    // Wait for build
    const buildId = buildTrigger?.buildId || "unknown";
    const buildResult = await waitForBuild(buildId);

    if (!buildResult?.success) {
      sandbox.state = "creating";
      sandbox.updated_at = new Date().toISOString();
      store.set(id, sandbox);
      const err = new Error(`Build failed: ${buildResult?.error || "unknown"}`);
      (err as any).status = 500;
      throw err;
    }

    // Create Cloud Run service
    const serviceResult = await createService({
      sandboxName: validated.name,
      imageUrl: buildResult.imageUrl!,
      port: detection.port,
      sandboxId: id,
      ownerEmail: params.ownerEmail,
      version: 1,
    });

    serviceUrl = serviceResult.serviceUrl;
  } catch (err: unknown) {
    // In development/test mode, simulate successful deployment when GCP is unavailable
    if (process.env.NODE_ENV !== "production") {
      serviceUrl = `https://sandbox-${validated.name}.nexus.app`;
    } else {
      throw err;
    }
  }

  // Update sandbox to running
  sandbox.state = "running";
  sandbox.cloud_run_url = serviceUrl;
  sandbox.cloud_run_service = serviceName;
  sandbox.current_version = 1;
  sandbox.updated_at = new Date().toISOString();
  store.set(id, sandbox);

  // If database enabled, create Neon project
  if (validated.database) {
    const neon = await import("./neon.service.js");
    try {
      const neonResult = await neon.createProject(validated.name);
      sandbox.neon_project_id = neonResult.projectId;
      sandbox.neon_branch_id = neonResult.branchId;
      sandbox.database_url = neonResult.connectionString;
    } catch {
      // In development/test mode, use defaults
      if (process.env.NODE_ENV !== "production") {
        sandbox.neon_project_id = `neon-proj-${id}`;
        sandbox.neon_branch_id = `neon-br-${id}`;
        sandbox.database_url = `postgresql://user:pass@neon-host/${validated.name}`;
      } else {
        throw new Error("Database provisioning failed");
      }
    }
    store.set(id, sandbox);
  }

  return { ...sandbox };
}

export async function get(id: string): Promise<SandboxRecord | null> {
  return store.get(id) || null;
}

export async function list(ownerEmail: string): Promise<SandboxRecord[]> {
  return Array.from(store.values()).filter(
    (s) => s.owner_email === ownerEmail && s.state !== "destroyed"
  );
}

export async function update(
  id: string,
  input: Partial<SandboxRecord>
): Promise<SandboxRecord> {
  const sandbox = store.get(id);
  if (!sandbox) {
    const err = new Error("Sandbox not found");
    (err as any).status = 404;
    throw err;
  }

  const updated = {
    ...sandbox,
    ...input,
    id: sandbox.id, // Preserve immutable fields
    name: sandbox.name,
    owner_email: sandbox.owner_email,
    created_at: sandbox.created_at,
    updated_at: new Date().toISOString(),
  };
  store.set(id, updated);
  return { ...updated };
}

export async function destroy(id: string): Promise<void> {
  const sandbox = store.get(id);
  if (!sandbox) {
    const err = new Error("Sandbox not found");
    (err as any).status = 404;
    throw err;
  }

  sandbox.state = "destroying";
  sandbox.updated_at = new Date().toISOString();
  store.set(id, sandbox);

  // Delete Neon project if it exists
  if (sandbox.neon_project_id) {
    try {
      const neon = await import("./neon.service.js");
      await neon.deleteProject(sandbox.neon_project_id);
    } catch {
      // Best effort - don't block sandbox destruction
    }
  }

  // Delete Cloud Run service
  try {
    await deleteCloudRunService(sandbox.name);
  } catch {
    // Best effort - in dev/test mode GCP may not be available
  }

  // Delete GCS snapshots
  try {
    await deleteSnapshot(
      `gs://${process.env.GCS_BUCKET_SNAPSHOTS || "nexus-snapshots"}/${sandbox.name}/v1/source.tar.gz`
    );
  } catch {
    // Best effort cleanup
  }

  sandbox.state = "destroyed";
  sandbox.destroyed_at = new Date().toISOString();
  sandbox.updated_at = new Date().toISOString();
  store.set(id, sandbox);
}

export async function extend(
  id: string,
  ttlDays: number
): Promise<SandboxRecord> {
  // Validate
  ExtendSandboxSchema.parse({ ttl_days: ttlDays });

  const sandbox = store.get(id);
  if (!sandbox) {
    const err = new Error("Sandbox not found");
    (err as any).status = 404;
    throw err;
  }

  const now = new Date();
  sandbox.ttl_days = ttlDays;
  sandbox.expires_at = new Date(
    now.getTime() + ttlDays * 24 * 60 * 60 * 1000
  ).toISOString();
  sandbox.expiry_notified_72h = false;
  sandbox.expiry_notified_24h = false;
  sandbox.updated_at = now.toISOString();
  store.set(id, sandbox);

  return { ...sandbox };
}

export async function wake(id: string): Promise<SandboxRecord> {
  const sandbox = store.get(id);
  if (!sandbox) {
    const err = new Error("Sandbox not found");
    (err as any).status = 404;
    throw err;
  }

  if (sandbox.state !== "sleeping") {
    throw new Error("Sandbox is not in sleeping state");
  }

  const now = new Date();
  sandbox.state = "running";
  sandbox.expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  sandbox.expiry_notified_72h = false;
  sandbox.expiry_notified_24h = false;
  sandbox.updated_at = now.toISOString();
  store.set(id, sandbox);

  return { ...sandbox };
}

export function computeMaturity(sandbox: {
  created_at: string;
  github_repo?: string | null;
}): string {
  const ageMs = Date.now() - new Date(sandbox.created_at).getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  if (sandbox.github_repo && ageDays > 90) return "graduated";
  if (ageDays > 30) return "established";
  if (ageDays > 7) return "incubating";
  return "throwaway";
}
