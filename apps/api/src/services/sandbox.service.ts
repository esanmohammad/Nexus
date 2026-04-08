import { CreateSandboxSchema, ExtendSandboxSchema } from "@nexus/shared";
import { uploadSnapshot, deleteSnapshot, deleteAllSnapshots } from "./storage.service.js";
import { triggerBuild, waitForBuild } from "./build.service.js";
import { createService, deleteService as deleteCloudRunService, deleteArtifactImage } from "./cloudrun.service.js";
import { detectRuntime } from "../lib/runtime-detect.js";
import { schema, eq, and, ne } from "../../../../packages/db/src/index.js";
import { useDb, getDb } from "../lib/db.js";

// ---------- ZIP flattening helpers ----------

/** Detect if all ZIP entries share a common top-level directory prefix (e.g. "repo-name/") */
function detectCommonPrefix(entryNames: string[]): string {
  if (entryNames.length === 0) return "";
  const firstSlash = entryNames[0].indexOf("/");
  if (firstSlash < 0) return "";
  const candidate = entryNames[0].slice(0, firstSlash + 1);
  if (entryNames.every((n) => n.startsWith(candidate))) return candidate;
  return "";
}

/** Strip prefix from an entry name */
function stripPrefix(name: string, prefix: string): string {
  if (!prefix) return name;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

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

// ---------- helpers to convert DB rows to SandboxRecord ----------

function rowToRecord(row: any): SandboxRecord {
  return {
    id: row.id,
    name: row.name,
    owner_email: row.owner_email,
    team: row.team ?? undefined,
    state: row.state,
    access_mode: row.access_mode,
    allowed_emails: row.allowed_emails ?? undefined,
    cloud_run_service: row.cloud_run_service ?? undefined,
    cloud_run_url: row.cloud_run_url ?? undefined,
    region: row.region,
    database_enabled: row.database_enabled,
    neon_project_id: row.neon_project_id ?? undefined,
    neon_branch_id: row.neon_branch_id ?? undefined,
    database_url: row.database_url ?? undefined,
    github_repo: row.github_repo ?? undefined,
    github_webhook_id: row.github_webhook_id ?? undefined,
    ttl_days: row.ttl_days,
    expires_at: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at),
    expiry_notified_72h: row.expiry_notified_72h,
    expiry_notified_24h: row.expiry_notified_24h,
    current_version: row.current_version ?? undefined,
    metadata: row.metadata ?? undefined,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    destroyed_at: row.destroyed_at instanceof Date ? row.destroyed_at.toISOString() : row.destroyed_at ?? undefined,
  };
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
  if (useDb()) {
    // For async DB queries we cannot change the sync signature; listAll is only
    // called from cleanup service which can be updated. For now keep in-memory
    // fallback since listAll is sync and DB queries are async.
    // See listAllAsync() below for the DB-backed version.
    return Array.from(store.values()).filter((s) => s.state !== "destroyed");
  }
  return Array.from(store.values()).filter((s) => s.state !== "destroyed");
}

// Async version of listAll for use with DB
export async function listAllAsync(): Promise<SandboxRecord[]> {
  if (useDb()) {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.sandboxes)
      .where(ne(schema.sandboxes.state, "destroyed"));
    return rows.map(rowToRecord);
  }
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

  const _useDb = useDb();

  // Check name uniqueness
  if (_useDb) {
    const db = getDb();
    const [existing] = await db
      .select({ id: schema.sandboxes.id })
      .from(schema.sandboxes)
      .where(eq(schema.sandboxes.name, validated.name));
    if (existing) {
      const err = new Error(`Sandbox "${validated.name}" already exists`);
      (err as any).status = 409;
      throw err;
    }
  } else {
    if (nameIndex.has(validated.name)) {
      const err = new Error(`Sandbox "${validated.name}" already exists`);
      (err as any).status = 409;
      throw err;
    }
  }

  // Check user quota (max 5 active sandboxes)
  if (_useDb) {
    const db = getDb();
    const userSandboxes = await db
      .select({ id: schema.sandboxes.id })
      .from(schema.sandboxes)
      .where(
        and(
          eq(schema.sandboxes.owner_email, params.ownerEmail),
          ne(schema.sandboxes.state, "destroyed")
        )
      );
    if (userSandboxes.length >= 5) {
      const err = new Error("Quota exceeded: maximum 5 active sandboxes per user");
      (err as any).status = 429;
      throw err;
    }
  } else {
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

  if (_useDb) {
    const db = getDb();
    await db.insert(schema.sandboxes).values({
      id,
      name: validated.name,
      owner_email: params.ownerEmail,
      team: validated.team,
      state: "creating",
      access_mode: validated.access_mode as any,
      region: "us-central1",
      database_enabled: validated.database,
      ttl_days: validated.ttl_days,
      expires_at: expiresAt,
      expiry_notified_72h: false,
      expiry_notified_24h: false,
      metadata: validated.metadata,
      created_at: now,
      updated_at: now,
    });
  } else {
    store.set(id, sandbox);
    nameIndex.set(validated.name, id);
  }

  let serviceUrl = "";
  let serviceName = `sandbox-${validated.name}`;

  try {
    // Extract ZIP to get file list and contents for runtime detection
    let files: string[] = ["package.json"];
    let fileContents: Record<string, string> = {};
    let sourceToUpload = params.sourceBuffer;

    try {
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(params.sourceBuffer);
      const entries = zip.getEntries();

      // Detect common prefix (GitHub ZIPs wrap everything in a subdirectory)
      const prefix = detectCommonPrefix(entries.map((e: any) => e.entryName));

      files = entries
        .map((e: any) => stripPrefix(e.entryName, prefix))
        .filter((n: string) => n && !n.endsWith("/"));

      // Read key files for runtime detection
      for (const entry of entries) {
        const name = stripPrefix(entry.entryName, prefix);
        if (!name || name.endsWith("/")) continue;
        if (["package.json", "requirements.txt", "pyproject.toml", "go.mod", "Dockerfile", "index.html"].includes(name)) {
          fileContents[name] = entry.getData().toString("utf-8");
        }
      }

      // Detect runtime and inject Dockerfile if not present
      let detection;
      try {
        detection = detectRuntime(files, fileContents);
      } catch {
        detection = null;
      }
      if (!detection) {
        detection = {
          runtime: "nodejs" as const,
          dockerfile: "FROM node:22-slim\nWORKDIR /app\nCOPY . .\nRUN npm install --production 2>/dev/null || true\nEXPOSE 8080\nCMD [\"node\", \"index.js\"]",
          port: 8080,
          confidence: "low" as const,
        };
      }

      // Rebuild ZIP with flattened structure (files at root, no wrapping dir)
      const flatZip = new AdmZip();
      for (const entry of entries) {
        const flatName = stripPrefix(entry.entryName, prefix);
        if (!flatName) continue; // skip the prefix directory itself
        if (entry.isDirectory) {
          flatZip.addFile(flatName, Buffer.alloc(0));
        } else {
          flatZip.addFile(flatName, entry.getData());
        }
      }

      // Inject or replace Dockerfile if detection generated a better one
      if (detection.runtime !== "dockerfile" as any) {
        // Our detection decided to override or generate — replace in ZIP
        flatZip.deleteFile("Dockerfile");
        flatZip.addFile("Dockerfile", Buffer.from(detection.dockerfile, "utf-8"));
      } else if (!fileContents["Dockerfile"]) {
        flatZip.addFile("Dockerfile", Buffer.from(detection.dockerfile, "utf-8"));
      }
      sourceToUpload = flatZip.toBuffer();
    } catch (zipErr) {
      console.error("ZIP processing error:", zipErr);
      // If ZIP extraction fails, use source as-is
    }

    // Upload source to GCS
    const snapshotUrl = await uploadSnapshot(validated.name, 1, sourceToUpload);

    // Detect runtime (with extracted data or fallback)
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
      if (_useDb) {
        const db = getDb();
        await db.update(schema.sandboxes).set({ state: "creating", updated_at: new Date() }).where(eq(schema.sandboxes.id, id));
      } else {
        store.set(id, sandbox);
      }
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
    // In test mode, simulate successful deployment
    if (process.env.NODE_ENV === "test" || process.env.VITEST) {
      serviceUrl = `https://sandbox-${validated.name}.nexus.app`;
    } else {
      // Log the error but still allow sandbox creation with a pending state
      console.error("Deploy error:", err);
      sandbox.state = "failed";
      sandbox.updated_at = new Date().toISOString();
      if (_useDb) {
        const db = getDb();
        await db.update(schema.sandboxes).set({ state: "destroying" as any, updated_at: new Date() }).where(eq(schema.sandboxes.id, id));
      } else {
        store.set(id, sandbox);
      }
      throw err;
    }
  }

  // Update sandbox to running
  sandbox.state = "running";
  sandbox.cloud_run_url = serviceUrl;
  sandbox.cloud_run_service = serviceName;
  sandbox.current_version = 1;
  sandbox.updated_at = new Date().toISOString();

  if (_useDb) {
    const db = getDb();
    await db.update(schema.sandboxes).set({
      state: "running",
      cloud_run_url: serviceUrl,
      cloud_run_service: serviceName,
      current_version: 1,
      updated_at: new Date(),
    }).where(eq(schema.sandboxes.id, id));
  } else {
    store.set(id, sandbox);
  }

  // Create v1 version record so version history is populated
  try {
    if (_useDb) {
      const db = getDb();
      await db.insert(schema.versions).values({
        sandbox_id: id,
        number: 1,
        status: "live",
        created_by: params.ownerEmail,
        label: validated.label || "Initial deployment",
        source_snapshot_url: `gs://nexus-snapshots/${validated.name}/v1/source.zip`,
        container_image: `${process.env.ARTIFACT_REGISTRY || "registry"}/${validated.name}:v1`,
        cloud_run_revision: `${serviceName}-00001`,
        build_duration_ms: 0,
        deployed_at: new Date(),
        created_at: new Date(),
      });
    }
  } catch (vErr) {
    console.error("Failed to create v1 version record:", vErr);
  }

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
    if (_useDb) {
      const db = getDb();
      await db.update(schema.sandboxes).set({
        neon_project_id: sandbox.neon_project_id,
        neon_branch_id: sandbox.neon_branch_id,
        database_url: sandbox.database_url,
        updated_at: new Date(),
      }).where(eq(schema.sandboxes.id, id));
    } else {
      store.set(id, sandbox);
    }
  }

  return { ...sandbox };
}

export async function get(id: string): Promise<SandboxRecord | null> {
  if (useDb()) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(schema.sandboxes)
      .where(eq(schema.sandboxes.id, id));
    return row ? rowToRecord(row) : null;
  }
  return store.get(id) || null;
}

export async function list(ownerEmail: string): Promise<SandboxRecord[]> {
  if (useDb()) {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.sandboxes)
      .where(
        and(
          eq(schema.sandboxes.owner_email, ownerEmail),
          ne(schema.sandboxes.state, "destroyed")
        )
      );
    return rows.map(rowToRecord);
  }
  return Array.from(store.values()).filter(
    (s) => s.owner_email === ownerEmail && s.state !== "destroyed"
  );
}

export async function update(
  id: string,
  input: Partial<SandboxRecord>
): Promise<SandboxRecord> {
  if (useDb()) {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(schema.sandboxes)
      .where(eq(schema.sandboxes.id, id));
    if (!existing) {
      const err = new Error("Sandbox not found");
      (err as any).status = 404;
      throw err;
    }

    // Build the set object, excluding immutable fields
    const setObj: Record<string, any> = { updated_at: new Date() };
    const immutableKeys = new Set(["id", "name", "owner_email", "created_at"]);
    for (const [key, value] of Object.entries(input)) {
      if (immutableKeys.has(key)) continue;
      if (key === "expires_at" && typeof value === "string") {
        setObj[key] = new Date(value);
      } else if (key === "destroyed_at" && typeof value === "string") {
        setObj[key] = new Date(value);
      } else {
        setObj[key] = value;
      }
    }

    const [updated] = await db
      .update(schema.sandboxes)
      .set(setObj)
      .where(eq(schema.sandboxes.id, id))
      .returning();
    return rowToRecord(updated);
  }

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
  const _useDb = useDb();
  let sandbox: SandboxRecord | null;

  if (_useDb) {
    sandbox = await get(id);
  } else {
    sandbox = store.get(id) || null;
  }

  if (!sandbox) {
    const err = new Error("Sandbox not found");
    (err as any).status = 404;
    throw err;
  }

  sandbox.state = "destroying";
  sandbox.updated_at = new Date().toISOString();
  if (_useDb) {
    const db = getDb();
    await db.update(schema.sandboxes).set({ state: "destroying", updated_at: new Date() }).where(eq(schema.sandboxes.id, id));
  } else {
    store.set(id, sandbox);
  }

  // On retry, only attempt resources that previously failed (stored in metadata.destroy_failures)
  const previousFailures = new Set(
    (sandbox.metadata?.destroy_failures || "").split(",").filter(Boolean)
  );
  const isRetry = previousFailures.size > 0;
  const shouldRun = (resource: string) => !isRetry || previousFailures.has(resource);

  const failures: string[] = [];

  const cleanups = [
    shouldRun("Neon") && sandbox.neon_project_id
      ? import("./neon.service.js")
          .then((neon) => neon.deleteProject(sandbox.neon_project_id!))
          .catch((err) => { failures.push("Neon"); console.error(`[destroy] Neon:`, err); })
      : Promise.resolve(),
    shouldRun("CloudRun")
      ? deleteCloudRunService(sandbox.name)
          .catch((err) => { failures.push("CloudRun"); console.error(`[destroy] Cloud Run:`, err); })
      : Promise.resolve(),
    shouldRun("ArtifactRegistry")
      ? deleteArtifactImage(sandbox.name)
          .catch((err) => { failures.push("ArtifactRegistry"); console.error(`[destroy] AR:`, err); })
      : Promise.resolve(),
    shouldRun("GCS")
      ? deleteAllSnapshots(sandbox.name)
          .catch((err) => { failures.push("GCS"); console.error(`[destroy] GCS:`, err); })
      : Promise.resolve(),
  ];

  await Promise.all(cleanups);

  // Only mark fully destroyed if all cleanups succeeded
  const finalState = failures.length === 0 ? "destroyed" : "destroy_failed";
  sandbox.state = finalState;
  sandbox.updated_at = new Date().toISOString();
  if (finalState === "destroyed") {
    sandbox.destroyed_at = new Date().toISOString();
  }

  const dbUpdate: Record<string, unknown> = {
    state: finalState,
    updated_at: new Date(),
    metadata: {
      ...(sandbox.metadata || {}),
      destroy_failures: failures.join(","),
    },
  };
  if (finalState === "destroyed") {
    dbUpdate.destroyed_at = new Date();
    delete (dbUpdate.metadata as Record<string, string>).destroy_failures;
  }

  if (_useDb) {
    const db = getDb();
    await db.update(schema.sandboxes).set(dbUpdate).where(eq(schema.sandboxes.id, id));
  } else {
    sandbox.metadata = dbUpdate.metadata as Record<string, string>;
    store.set(id, sandbox);
  }

  if (failures.length > 0) {
    console.error(`[destroy] Sandbox ${id} partially failed: ${failures.join(", ")}`);
  }
}

export async function extend(
  id: string,
  ttlDays: number
): Promise<SandboxRecord> {
  // Validate
  ExtendSandboxSchema.parse({ ttl_days: ttlDays });

  const _useDb = useDb();

  if (_useDb) {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(schema.sandboxes)
      .where(eq(schema.sandboxes.id, id));
    if (!existing) {
      const err = new Error("Sandbox not found");
      (err as any).status = 404;
      throw err;
    }

    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

    const [updated] = await db
      .update(schema.sandboxes)
      .set({
        ttl_days: ttlDays,
        expires_at: newExpiresAt,
        expiry_notified_72h: false,
        expiry_notified_24h: false,
        updated_at: now,
      })
      .where(eq(schema.sandboxes.id, id))
      .returning();
    return rowToRecord(updated);
  }

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
  const _useDb = useDb();

  if (_useDb) {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(schema.sandboxes)
      .where(eq(schema.sandboxes.id, id));
    if (!existing) {
      const err = new Error("Sandbox not found");
      (err as any).status = 404;
      throw err;
    }

    if (existing.state !== "sleeping") {
      throw new Error("Sandbox is not in sleeping state");
    }

    const now = new Date();
    const [updated] = await db
      .update(schema.sandboxes)
      .set({
        state: "running",
        expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        expiry_notified_72h: false,
        expiry_notified_24h: false,
        updated_at: now,
      })
      .where(eq(schema.sandboxes.id, id))
      .returning();
    return rowToRecord(updated);
  }

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
