# Nexus — Wave Implementation Plan

**Version:** 1.0
**Date:** 2026-04-06
**Purpose:** Step-by-step autonomous build plan. Each wave produces a working increment. Each task has exact file paths, function signatures, DB schemas, and acceptance criteria so an LLM can execute without ambiguity.

**Companion docs:** [SPEC.md](./SPEC.md) · [SPEC-v2.md](./SPEC-v2.md) · [TECH-STACK.md](./TECH-STACK.md) · [FREE-TIER-PLAN.md](./FREE-TIER-PLAN.md)

---

## Global Decisions (Apply Everywhere)

```
Language:        TypeScript 5.x (all apps except CLI)
Runtime:         Node.js 22 LTS
Package manager: pnpm 9+
Monorepo:        Turborepo
API framework:   Hono (lightweight, edge-compatible, Cloud Run friendly)
ORM:             Drizzle ORM (type-safe, SQL-first)
Validation:      Zod (shared between API + clients)
Web UI:          Next.js 15 (App Router) + React 19 + Tailwind v4 + shadcn/ui
Testing:         Vitest (unit/integration) + Playwright (E2E)
Linting:         ESLint 9 (flat config) + Prettier
CLI:             TypeScript via oclif (defer Go to later)
DB:              Neon (free tier) for both control plane and sandbox DBs
Auth (testing):  Google OAuth 2.0 (simple, free) + Cloud Run IAM
Auth (prod):     Cloudflare Zero Trust + SSO (deferred)
Region:          us-central1 (Cloud Run free tier region)
```

---

## Repository Structure (Create in Wave 0)

```
nexus/
├── package.json                    ← Root workspace config
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .gitignore
├── .env.example
├── apps/
│   ├── api/                        ← Hono API server
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── index.ts            ← Hono app entry
│   │   │   ├── routes/
│   │   │   │   ├── sandboxes.ts
│   │   │   │   ├── versions.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── health.ts
│   │   │   │   └── proxy.ts        ← Auth proxy for sandbox access
│   │   │   ├── services/
│   │   │   │   ├── sandbox.service.ts
│   │   │   │   ├── version.service.ts
│   │   │   │   ├── build.service.ts
│   │   │   │   ├── cloudrun.service.ts
│   │   │   │   ├── storage.service.ts
│   │   │   │   ├── access.service.ts
│   │   │   │   ├── neon.service.ts
│   │   │   │   ├── cleanup.service.ts
│   │   │   │   └── notification.service.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── error-handler.ts
│   │   │   │   └── audit-log.ts
│   │   │   └── lib/
│   │   │       ├── config.ts        ← Environment config loader
│   │   │       ├── gcp.ts           ← GCP client initialization
│   │   │       └── runtime-detect.ts ← Dockerfile generation logic
│   │   └── test/
│   │       ├── sandbox.test.ts
│   │       ├── version.test.ts
│   │       └── build.test.ts
│   ├── web/                         ← Next.js dashboard
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.ts
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx         ← Dashboard (sandbox list)
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── sandboxes/
│   │   │   │   │   ├── new/page.tsx  ← Create sandbox
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── page.tsx  ← Sandbox detail
│   │   │   │   │       ├── versions/page.tsx
│   │   │   │   │       ├── deploy/page.tsx
│   │   │   │   │       ├── share/page.tsx
│   │   │   │   │       └── settings/page.tsx
│   │   │   │   └── admin/
│   │   │   │       └── page.tsx
│   │   │   ├── components/
│   │   │   │   ├── sandbox-card.tsx
│   │   │   │   ├── version-timeline.tsx
│   │   │   │   ├── deploy-dropzone.tsx
│   │   │   │   ├── build-log-stream.tsx
│   │   │   │   ├── share-dialog.tsx
│   │   │   │   ├── ttl-slider.tsx
│   │   │   │   └── status-badge.tsx
│   │   │   └── lib/
│   │   │       ├── api-client.ts     ← Uses @nexus/sdk
│   │   │       └── auth.ts
│   │   └── test/
│   ├── cli/                          ← oclif CLI
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── bin/
│   │   │   └── run.ts
│   │   └── src/
│   │       ├── commands/
│   │       │   ├── login.ts
│   │       │   ├── create.ts
│   │       │   ├── deploy.ts
│   │       │   ├── rollback.ts
│   │       │   ├── list.ts
│   │       │   ├── info.ts
│   │       │   ├── destroy.ts
│   │       │   ├── extend.ts
│   │       │   ├── share.ts
│   │       │   ├── logs.ts
│   │       │   ├── versions.ts
│   │       │   └── env.ts
│   │       └── lib/
│   │           ├── config.ts
│   │           └── auth.ts
│   ├── mcp-server/                   ← MCP server for Claude Code
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── tools/
│   │           ├── sandbox-create.ts
│   │           ├── sandbox-deploy.ts
│   │           ├── sandbox-rollback.ts
│   │           ├── sandbox-status.ts
│   │           ├── sandbox-share.ts
│   │           ├── sandbox-logs.ts
│   │           ├── sandbox-list.ts
│   │           ├── sandbox-destroy.ts
│   │           └── sandbox-extend.ts
│   └── slack-bot/                    ← Slack Bolt app
│       ├── package.json
│       ├── tsconfig.json
│       ├── Dockerfile
│       └── src/
│           ├── index.ts
│           ├── handlers/
│           │   ├── create.ts
│           │   ├── deploy.ts
│           │   ├── rollback.ts
│           │   ├── status.ts
│           │   ├── share.ts
│           │   ├── extend.ts
│           │   └── destroy.ts
│           └── lib/
│               ├── parser.ts         ← Parse Slack messages into intents
│               └── blocks.ts         ← Block Kit message builders
├── packages/
│   ├── shared/                       ← Shared types + Zod schemas
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── schemas/
│   │       │   ├── sandbox.ts
│   │       │   ├── version.ts
│   │       │   ├── database.ts
│   │       │   ├── access-policy.ts
│   │       │   └── api.ts           ← Request/response schemas
│   │       └── types/
│   │           ├── sandbox.ts
│   │           ├── version.ts
│   │           └── enums.ts
│   ├── db/                           ← Drizzle schema + migrations
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   └── src/
│   │       ├── index.ts              ← DB client export
│   │       ├── schema/
│   │       │   ├── sandboxes.ts
│   │       │   ├── versions.ts
│   │       │   ├── audit-logs.ts
│   │       │   └── users.ts
│   │       └── migrations/
│   └── sdk/                          ← TypeScript API client
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── client.ts
│           ├── sandboxes.ts
│           └── versions.ts
└── infra/
    └── dockerfiles/
        ├── node.Dockerfile           ← Template for Node.js sandboxes
        ├── python.Dockerfile         ← Template for Python sandboxes
        ├── static.Dockerfile         ← Template for static sites (nginx)
        └── go.Dockerfile             ← Template for Go sandboxes
```

---

# WAVE 0 — Project Scaffolding

**Goal:** Empty monorepo that builds, lints, and has CI. Zero functionality, but every developer (or LLM) can start coding immediately.

**Duration:** Day 1

## Task 0.1 — Initialize Monorepo Root

**Create these files:**

### `package.json`
```json
{
  "name": "nexus",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "test": "turbo test",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "check-format": "prettier --check \"**/*.{ts,tsx,json,md}\""
  },
  "devDependencies": {
    "turbo": "^2.4",
    "prettier": "^3.5",
    "typescript": "^5.7"
  },
  "engines": {
    "node": ">=22",
    "pnpm": ">=9"
  },
  "packageManager": "pnpm@9.15.0"
}
```

### `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### `turbo.json`
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

### `tsconfig.base.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

### `.gitignore`
```
node_modules/
dist/
.next/
.turbo/
*.env
!.env.example
.DS_Store
```

### `.env.example`
```bash
# GCP
GCP_PROJECT_ID=nexus-dev
GCP_REGION=us-central1
GCS_BUCKET_SNAPSHOTS=nexus-snapshots
ARTIFACT_REGISTRY=us-central1-docker.pkg.dev/nexus-dev/sandboxes

# Neon (control plane DB)
DATABASE_URL=postgresql://...@...neon.tech/control_plane

# Auth (testing: Google OAuth)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
JWT_SECRET=change-me-in-production
SESSION_SECRET=change-me-in-production

# Slack (Wave 3)
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
SLACK_APP_TOKEN=

# Neon API (for provisioning sandbox DBs)
NEON_API_KEY=

# Cloudflare (production only, deferred)
# CLOUDFLARE_API_TOKEN=
# CLOUDFLARE_ACCOUNT_ID=
# CLOUDFLARE_TUNNEL_ID=
```

## Task 0.2 — Initialize `packages/shared`

### `packages/shared/package.json`
```json
{
  "name": "@nexus/shared",
  "version": "0.0.1",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.24"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3.1"
  }
}
```

### `packages/shared/src/enums.ts`
```typescript
export const SandboxState = {
  CREATING: "creating",
  RUNNING: "running",
  SLEEPING: "sleeping",
  DESTROYING: "destroying",
  DESTROYED: "destroyed",
} as const;
export type SandboxState = (typeof SandboxState)[keyof typeof SandboxState];

export const VersionStatus = {
  BUILDING: "building",
  LIVE: "live",
  ROLLED_BACK: "rolled_back",
  FAILED: "failed",
} as const;
export type VersionStatus = (typeof VersionStatus)[keyof typeof VersionStatus];

export const AccessMode = {
  OWNER_ONLY: "owner_only",
  TEAM: "team",
  ANYONE: "anyone",
  CUSTOM: "custom",
} as const;
export type AccessMode = (typeof AccessMode)[keyof typeof AccessMode];

export const Runtime = {
  NODEJS: "nodejs",
  PYTHON: "python",
  STATIC: "static",
  GO: "go",
  DOCKERFILE: "dockerfile",
} as const;
export type Runtime = (typeof Runtime)[keyof typeof Runtime];

export const DatabaseState = {
  PROVISIONING: "provisioning",
  READY: "ready",
  DESTROYING: "destroying",
  DESTROYED: "destroyed",
} as const;
export type DatabaseState = (typeof DatabaseState)[keyof typeof DatabaseState];

export const SandboxMaturity = {
  THROWAWAY: "throwaway",       // TTL 1-7d
  INCUBATING: "incubating",     // TTL 7-30d
  ESTABLISHED: "established",   // TTL 30-90d
  GRADUATED: "graduated",       // Permanent
} as const;
export type SandboxMaturity = (typeof SandboxMaturity)[keyof typeof SandboxMaturity];
```

### `packages/shared/src/schemas/sandbox.ts`
```typescript
import { z } from "zod";

export const CreateSandboxSchema = z.object({
  name: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, "Must be URL-safe lowercase with hyphens"),
  runtime: z.enum(["nodejs", "python", "static", "go", "dockerfile"]).optional(),
  database: z.boolean().default(false),
  ttl_days: z.number().int().min(1).max(90).default(7),
  access_mode: z.enum(["owner_only", "team", "anyone", "custom"]).default("owner_only"),
  allowed_emails: z.array(z.string().email()).optional(),
  team: z.string().optional(),
  label: z.string().max(200).optional(),
  metadata: z.record(z.string()).optional(),
});

export const UpdateSandboxSchema = z.object({
  name: z.string().min(3).max(63).optional(),
  ttl_days: z.number().int().min(1).max(90).optional(),
  access_mode: z.enum(["owner_only", "team", "anyone", "custom"]).optional(),
  allowed_emails: z.array(z.string().email()).optional(),
  team: z.string().optional(),
});

export const ExtendSandboxSchema = z.object({
  ttl_days: z.number().int().min(1).max(90),
});

export const ShareSandboxSchema = z.object({
  access_mode: z.enum(["owner_only", "team", "anyone", "custom"]),
  allowed_emails: z.array(z.string().email()).optional(),
});

export type CreateSandboxInput = z.infer<typeof CreateSandboxSchema>;
export type UpdateSandboxInput = z.infer<typeof UpdateSandboxSchema>;
export type ExtendSandboxInput = z.infer<typeof ExtendSandboxSchema>;
export type ShareSandboxInput = z.infer<typeof ShareSandboxSchema>;
```

### `packages/shared/src/schemas/version.ts`
```typescript
import { z } from "zod";

export const DeployVersionSchema = z.object({
  label: z.string().max(200).optional(),
  migration_sql: z.string().optional(),
});

export const RollbackSchema = z.object({
  target_version: z.number().int().positive().optional(), // default: previous
});

export type DeployVersionInput = z.infer<typeof DeployVersionSchema>;
export type RollbackInput = z.infer<typeof RollbackSchema>;
```

### `packages/shared/src/index.ts`
```typescript
export * from "./enums.js";
export * from "./schemas/sandbox.js";
export * from "./schemas/version.js";
```

## Task 0.3 — Initialize `packages/db`

### `packages/db/package.json`
```json
{
  "name": "@nexus/db",
  "version": "0.0.1",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate",
    "studio": "drizzle-kit studio"
  },
  "dependencies": {
    "drizzle-orm": "^0.39",
    "@neondatabase/serverless": "^0.10"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30",
    "typescript": "^5.7"
  }
}
```

### `packages/db/src/schema/sandboxes.ts`
```typescript
import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

export const sandboxStateEnum = pgEnum("sandbox_state", [
  "creating",
  "running",
  "sleeping",
  "destroying",
  "destroyed",
]);

export const accessModeEnum = pgEnum("access_mode", [
  "owner_only",
  "team",
  "anyone",
  "custom",
]);

export const runtimeEnum = pgEnum("runtime", [
  "nodejs",
  "python",
  "static",
  "go",
  "dockerfile",
]);

export const sandboxes = pgTable("sandboxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  owner_email: text("owner_email").notNull(),
  team: text("team"),
  runtime: runtimeEnum("runtime"),
  state: sandboxStateEnum("state").notNull().default("creating"),
  access_mode: accessModeEnum("access_mode").notNull().default("owner_only"),
  allowed_emails: jsonb("allowed_emails").$type<string[]>().default([]),

  // Cloud Run
  cloud_run_service: text("cloud_run_service"),     // Full service name
  cloud_run_url: text("cloud_run_url"),             // *.run.app URL
  region: text("region").notNull().default("us-central1"),

  // Database (Neon)
  database_enabled: boolean("database_enabled").notNull().default(false),
  neon_project_id: text("neon_project_id"),
  neon_branch_id: text("neon_branch_id"),
  database_url: text("database_url"),               // Encrypted or reference

  // TTL
  ttl_days: integer("ttl_days").notNull().default(7),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  expiry_notified_72h: boolean("expiry_notified_72h").notNull().default(false),
  expiry_notified_24h: boolean("expiry_notified_24h").notNull().default(false),

  // GitHub (optional)
  github_repo: text("github_repo"),                 // "org/repo"
  github_webhook_id: text("github_webhook_id"),

  // Metadata
  current_version: integer("current_version").default(0),
  metadata: jsonb("metadata").$type<Record<string, string>>().default({}),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  destroyed_at: timestamp("destroyed_at", { withTimezone: true }),
});
```

### `packages/db/src/schema/versions.ts`
```typescript
import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sandboxes } from "./sandboxes.js";

export const versionStatusEnum = pgEnum("version_status", [
  "building",
  "live",
  "rolled_back",
  "failed",
]);

export const versions = pgTable("versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sandbox_id: uuid("sandbox_id")
    .notNull()
    .references(() => sandboxes.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),               // v1, v2, v3...
  label: text("label"),                               // User-facing label
  status: versionStatusEnum("status").notNull().default("building"),

  // Build artifacts
  source_snapshot_url: text("source_snapshot_url"),   // GCS URL
  container_image: text("container_image"),           // Artifact Registry URL
  cloud_run_revision: text("cloud_run_revision"),     // Cloud Run revision name
  build_log_url: text("build_log_url"),               // GCS URL to build log

  // Database migration
  migration_sql: text("migration_sql"),               // Raw SQL (nullable)
  neon_branch_id: text("neon_branch_id"),             // Neon branch for this version

  // Metadata
  created_by: text("created_by").notNull(),           // Email
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deployed_at: timestamp("deployed_at", { withTimezone: true }),
  build_duration_ms: integer("build_duration_ms"),
});
```

### `packages/db/src/schema/audit-logs.ts`
```typescript
import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor_email: text("actor_email").notNull(),
  action: text("action").notNull(),                  // "sandbox.create", "version.deploy", etc.
  resource_type: text("resource_type").notNull(),    // "sandbox", "version"
  resource_id: text("resource_id").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().default({}),
  ip_address: text("ip_address"),
  user_agent: text("user_agent"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### `packages/db/src/index.ts`
```typescript
import { drizzle } from "drizzle-orm/neon-serverless";
import { neon } from "@neondatabase/serverless";
import * as sandboxSchema from "./schema/sandboxes.js";
import * as versionSchema from "./schema/versions.js";
import * as auditSchema from "./schema/audit-logs.js";

export const schema = {
  ...sandboxSchema,
  ...versionSchema,
  ...auditSchema,
};

export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;
export { sandboxSchema, versionSchema, auditSchema };
```

### `packages/db/drizzle.config.ts`
```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/*.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## Task 0.4 — Initialize `apps/api` (Empty Hono Server)

### `apps/api/package.json`
```json
{
  "name": "@nexus/api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "lint": "eslint src/",
    "test": "vitest run"
  },
  "dependencies": {
    "hono": "^4.7",
    "@hono/node-server": "^1.13",
    "@nexus/shared": "workspace:*",
    "@nexus/db": "workspace:*",
    "zod": "^3.24"
  },
  "devDependencies": {
    "tsx": "^4.19",
    "typescript": "^5.7",
    "vitest": "^3.1",
    "@types/node": "^22"
  }
}
```

### `apps/api/src/index.ts`
```typescript
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { healthRoute } from "./routes/health.js";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.route("/api/health", healthRoute);

// Placeholder — routes added in Wave 1
// app.route("/api/sandboxes", sandboxRoutes);

const port = parseInt(process.env.PORT || "8080");
console.log(`API server starting on port ${port}`);
serve({ fetch: app.fetch, port });

export default app;
```

### `apps/api/src/routes/health.ts`
```typescript
import { Hono } from "hono";

export const healthRoute = new Hono();

healthRoute.get("/", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});
```

### `apps/api/Dockerfile`
```dockerfile
FROM node:22-slim AS base
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile
COPY packages/ packages/
COPY apps/api/ apps/api/
RUN pnpm --filter @nexus/shared build
RUN pnpm --filter @nexus/db build
RUN pnpm --filter @nexus/api build

FROM base AS runtime
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/packages/db/package.json ./packages/db/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "apps/api/dist/index.js"]
```

## Task 0.5 — Initialize `apps/web` (Empty Next.js)

Standard `create-next-app` with App Router, Tailwind v4, TypeScript. Add shadcn/ui.

### `apps/web/package.json`
```json
{
  "name": "@nexus/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "next build",
    "dev": "next dev --port 3000",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.3",
    "react": "^19",
    "react-dom": "^19",
    "@nexus/shared": "workspace:*",
    "@nexus/sdk": "workspace:*",
    "@tanstack/react-query": "^5.75",
    "tailwindcss": "^4"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "@types/node": "^22",
    "@types/react": "^19"
  }
}
```

### `apps/web/src/app/page.tsx`
```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold">Nexus</h1>
      <p className="mt-4 text-lg text-gray-500">What do you want to ship?</p>
    </main>
  );
}
```

## Task 0.6 — GitHub Actions CI

### `.github/workflows/ci.yml`
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm lint
      - run: pnpm test
```

## Wave 0 Acceptance Criteria

```
✅ pnpm install succeeds
✅ pnpm build succeeds (all packages + apps compile)
✅ pnpm lint passes
✅ apps/api dev server starts and /api/health returns 200
✅ apps/web dev server starts and renders landing page
✅ GitHub Actions CI passes on push
✅ packages/db Drizzle schema compiles (no DB connection needed yet)
```

---

# WAVE 1 — Core API + Build Pipeline

**Goal:** Create a sandbox from a ZIP upload, build a container, deploy to Cloud Run, get a live URL. The absolute minimum viable path.

**Duration:** Week 1-2

**Prerequisites:** GCP project created, Neon account created, GCS bucket created, Artifact Registry repo created.

## Task 1.1 — Config & GCP Client Setup

### `apps/api/src/lib/config.ts`
```typescript
import { z } from "zod";

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(8080),
  GCP_PROJECT_ID: z.string(),
  GCP_REGION: z.string().default("us-central1"),
  GCS_BUCKET_SNAPSHOTS: z.string(),
  ARTIFACT_REGISTRY: z.string(), // e.g. "us-central1-docker.pkg.dev/project/sandboxes"
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const config = ConfigSchema.parse(process.env);
export type Config = z.infer<typeof ConfigSchema>;
```

### `apps/api/src/lib/gcp.ts`

Initialize GCP clients for Cloud Build, Cloud Run, GCS, Artifact Registry. Use `@google-cloud/*` client libraries.

```typescript
import { CloudBuildClient } from "@google-cloud/cloudbuild";
import { ServicesClient, RevisionsClient } from "@google-cloud/run";
import { Storage } from "@google-cloud/storage";

export const cloudBuild = new CloudBuildClient();
export const cloudRunServices = new ServicesClient();
export const cloudRunRevisions = new RevisionsClient();
export const storage = new Storage();

export function getSnapshotsBucket() {
  return storage.bucket(process.env.GCS_BUCKET_SNAPSHOTS!);
}
```

## Task 1.2 — Storage Service (GCS Snapshots)

### `apps/api/src/services/storage.service.ts`

```typescript
interface StorageService {
  // Upload a tarball/ZIP buffer to GCS, return the GCS URL
  uploadSnapshot(sandboxName: string, version: number, buffer: Buffer): Promise<string>;

  // Download a snapshot tarball
  downloadSnapshot(gcsUrl: string): Promise<Buffer>;

  // Delete a snapshot
  deleteSnapshot(gcsUrl: string): Promise<void>;

  // Upload build log text
  uploadBuildLog(sandboxName: string, version: number, log: string): Promise<string>;
}
```

**Implementation details:**
- Upload to `gs://{bucket}/{sandboxName}/v{version}/source.tar.gz`
- Set metadata: `sandbox={name}`, `version={N}`, `uploaded_at={ISO}`
- Return full `gs://` URL
- Max upload size: 100 MB (validate before upload)

## Task 1.3 — Runtime Detection

### `apps/api/src/lib/runtime-detect.ts`

Given an extracted source directory listing, detect the runtime and generate a Dockerfile.

```typescript
interface RuntimeDetectionResult {
  runtime: "nodejs" | "python" | "static" | "go" | "dockerfile";
  dockerfile: string;      // Generated or user-provided Dockerfile content
  port: number;            // Detected or default port
  buildCommand?: string;   // e.g. "npm run build"
  startCommand?: string;   // e.g. "node dist/server.js"
  confidence: "high" | "medium" | "low";
}

export function detectRuntime(files: string[], fileContents: Record<string, string>): RuntimeDetectionResult;
```

**Detection logic (in priority order):**

1. If `Dockerfile` exists → `{ runtime: "dockerfile", dockerfile: <file contents>, port: parse EXPOSE or default 8080 }`
2. If `sandbox.toml` exists → parse it, use specified runtime/commands/port
3. If `package.json` exists:
   - Parse it. If `dependencies` includes `next` → Next.js template (port 3000)
   - If `scripts.start` exists → Node.js template using `npm start`
   - Else → Node.js template with `node index.js` or `node server.js`
4. If `requirements.txt` or `pyproject.toml` exists → Python template (gunicorn, port 8080)
5. If `go.mod` exists → Go template (port 8080)
6. If `index.html` exists → Static (nginx, port 80 → mapped to 8080)
7. Fallback → error, ask user to specify runtime

**Dockerfile templates** — stored in `infra/dockerfiles/`, read and interpolated:

Node.js template (`infra/dockerfiles/node.Dockerfile`):
```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
{{BUILD_COMMAND}}
EXPOSE {{PORT}}
CMD {{START_COMMAND}}
```

## Task 1.4 — Build Service (Cloud Build)

### `apps/api/src/services/build.service.ts`

```typescript
interface BuildService {
  // Trigger a Cloud Build from a GCS source snapshot
  // Returns { buildId, imageUrl } on success, { error, log } on failure
  triggerBuild(params: {
    sandboxName: string;
    version: number;
    snapshotUrl: string;     // GCS URL to source tarball
    dockerfile: string;       // Dockerfile content (will be written into source)
    imageTag: string;         // Target Artifact Registry tag
  }): Promise<BuildResult>;

  // Poll build status (or use Cloud Build subscription)
  getBuildStatus(buildId: string): Promise<BuildStatus>;

  // Get build log
  getBuildLog(buildId: string): Promise<string>;
}

interface BuildResult {
  success: boolean;
  buildId: string;
  imageUrl?: string;          // On success
  error?: string;             // On failure (human-readable summary)
  logUrl?: string;
  durationMs?: number;
}
```

**Implementation details:**
- Use `CloudBuildClient.createBuild()` with:
  - Source: `storageSource: { bucket, object }` pointing to the GCS snapshot
  - Steps: single step `gcr.io/cloud-builders/docker build -t {imageTag} .`
  - Images: `[imageTag]` to push to Artifact Registry
  - Timeout: 600s (10 min)
  - Tags: `["sandbox-{name}", "v{version}"]`
- Poll `getBuild()` every 5s until terminal state
- On failure, parse the build log for common errors (see Task 1.3 runtime-detect)
- Image tag format: `{ARTIFACT_REGISTRY}/{sandboxName}:v{version}`

## Task 1.5 — Cloud Run Service

### `apps/api/src/services/cloudrun.service.ts`

```typescript
interface CloudRunService {
  // Create a new Cloud Run service (first deploy)
  createService(params: {
    sandboxName: string;
    imageUrl: string;
    port: number;
    envVars?: Record<string, string>;
    region?: string;
  }): Promise<{ serviceUrl: string; revisionName: string }>;

  // Deploy a new revision (subsequent deploys)
  deployRevision(params: {
    sandboxName: string;
    imageUrl: string;
    port: number;
    envVars?: Record<string, string>;
  }): Promise<{ revisionName: string }>;

  // Shift traffic to a specific revision (for rollback)
  shiftTraffic(params: {
    sandboxName: string;
    revisionName: string;
  }): Promise<void>;

  // Delete a Cloud Run service
  deleteService(sandboxName: string): Promise<void>;

  // Get service URL
  getServiceUrl(sandboxName: string): Promise<string | null>;
}
```

**Implementation details:**
- Service name: `sandbox-{name}` (Cloud Run service naming)
- Deploy with `--no-allow-unauthenticated` (testing mode: IAM-based access)
- Set labels: `sandbox={name}`, `owner={email}`, `version=v{N}`
- Environment variables injected: `SANDBOX_ID`, `SANDBOX_NAME`, `VERSION`, `PORT`, plus user-defined
- Resources: 1 vCPU, 512 MB memory, max 2 instances, min 0 (scale to zero)
- Ingress: all (for testing; restrict to internal+cloudflare in production)
- Traffic: 100% to latest revision on deploy

## Task 1.6 — Sandbox Service (Orchestrator)

### `apps/api/src/services/sandbox.service.ts`

This is the main orchestrator. It coordinates storage, build, and Cloud Run.

```typescript
interface SandboxService {
  create(input: CreateSandboxInput & { ownerEmail: string; sourceBuffer: Buffer }): Promise<Sandbox>;
  get(id: string): Promise<Sandbox | null>;
  list(ownerEmail: string): Promise<Sandbox[]>;
  update(id: string, input: UpdateSandboxInput): Promise<Sandbox>;
  destroy(id: string): Promise<void>;
  extend(id: string, ttlDays: number): Promise<Sandbox>;
}
```

**`create` flow (the critical path):**
```
1. Validate input (Zod schema)
2. Check uniqueness of name
3. Check user quota (max 5 active sandboxes)
4. Insert sandbox row (state: "creating")
5. Upload source to GCS → snapshotUrl
6. Detect runtime → Dockerfile + port
7. Trigger Cloud Build → poll until done
   - On build failure: set state to "creating" (failed), store error, return error
8. Create Cloud Run service → serviceUrl, revisionName
9. Insert version row (v1, status: "live")
10. Update sandbox row (state: "running", cloud_run_url, current_version: 1)
11. Return sandbox with URL
```

**Duration target: < 3 minutes** for the full create flow. Most time is in step 7 (Cloud Build).

## Task 1.7 — API Routes (Sandboxes)

### `apps/api/src/routes/sandboxes.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { CreateSandboxSchema, UpdateSandboxSchema, ExtendSandboxSchema, ShareSandboxSchema } from "@nexus/shared";

const app = new Hono();

// POST /api/sandboxes — Create sandbox (multipart: JSON config + ZIP file)
app.post("/", async (c) => {
  // Parse multipart form: "config" (JSON) + "source" (file)
  // Validate config against CreateSandboxSchema
  // Extract owner email from auth context
  // Call sandboxService.create(...)
  // Return 201 { sandbox }
});

// GET /api/sandboxes — List my sandboxes
app.get("/", async (c) => {
  // Extract owner email from auth context
  // Call sandboxService.list(ownerEmail)
  // Return 200 { sandboxes }
});

// GET /api/sandboxes/:id — Get sandbox details
app.get("/:id", async (c) => {
  // Call sandboxService.get(id)
  // Check ownership or shared access
  // Return 200 { sandbox, versions }
});

// PATCH /api/sandboxes/:id — Update sandbox
app.patch("/:id", zValidator("json", UpdateSandboxSchema), async (c) => {
  // Validate ownership
  // Call sandboxService.update(id, input)
  // Return 200 { sandbox }
});

// DELETE /api/sandboxes/:id — Destroy sandbox
app.delete("/:id", async (c) => {
  // Validate ownership
  // Call sandboxService.destroy(id) — async
  // Return 202 { message: "Destroying..." }
});

// POST /api/sandboxes/:id/extend — Extend TTL
app.post("/:id/extend", zValidator("json", ExtendSandboxSchema), async (c) => { });

// POST /api/sandboxes/:id/share — Update access policy
app.post("/:id/share", zValidator("json", ShareSandboxSchema), async (c) => { });

export { app as sandboxRoutes };
```

### `apps/api/src/routes/versions.ts`

```typescript
// POST /api/sandboxes/:id/versions — Deploy new version
// Accepts multipart: "config" (JSON with label, migration_sql) + "source" (file)
// Flow:
//   1. Get sandbox from DB
//   2. Upload source snapshot
//   3. Detect runtime (or reuse previous)
//   4. Trigger build
//   5. Deploy new revision
//   6. Shift traffic
//   7. Insert version row, update sandbox.current_version
//   8. Return 201 { version }

// GET /api/sandboxes/:id/versions — List versions

// GET /api/sandboxes/:id/versions/:num — Get version details

// POST /api/sandboxes/:id/rollback — Roll back
// Flow:
//   1. Find target version (default: previous live version)
//   2. Verify it has a cloud_run_revision
//   3. Call cloudRunService.shiftTraffic(revision)
//   4. Update version statuses in DB
//   5. Return 200 { version }
```

## Task 1.8 — Auth Proxy (Testing Mode)

### `apps/api/src/routes/proxy.ts`

Since sandboxes are deployed with `--no-allow-unauthenticated`, we need a proxy for users without GCP accounts.

```typescript
// GET /api/proxy/:sandboxName/*
// 1. Verify user is authenticated (session cookie or JWT)
// 2. Check user has access to this sandbox (owner, team, or shared)
// 3. Get sandbox Cloud Run URL from DB
// 4. Fetch target URL using control plane's service account identity token
// 5. Stream response back to user
//
// This allows: https://control-plane.run.app/api/proxy/marketing-dash/
// to proxy to: https://sandbox-marketing-dash-abc123-uc.a.run.app/
```

**Implementation:** Use `google-auth-library` to get an identity token for the Cloud Run service, then `fetch()` with that token and stream the response.

## Task 1.9 — Auth Middleware (Google OAuth for Testing)

### `apps/api/src/middleware/auth.ts`

For testing, use simple Google OAuth 2.0:

```typescript
// POST /api/auth/login — Start Google OAuth flow
// GET /api/auth/callback — Handle OAuth callback, set session cookie
// GET /api/auth/me — Return current user info
// POST /api/auth/logout — Clear session

// Middleware: extract user from session cookie or Bearer JWT
// Sets c.set("user", { email, name }) on the Hono context
```

Use `hono/cookie` for session management with a signed JWT cookie.

## Wave 1 Acceptance Criteria

```
✅ POST /api/sandboxes with ZIP file → creates sandbox, returns URL
✅ Source snapshot uploaded to GCS
✅ Runtime auto-detected from ZIP contents
✅ Dockerfile generated if not present
✅ Cloud Build triggered, image pushed to Artifact Registry
✅ Cloud Run service created, revision deployed
✅ GET /api/sandboxes lists user's sandboxes
✅ GET /api/sandboxes/:id returns sandbox details with URL
✅ DELETE /api/sandboxes/:id destroys Cloud Run service
✅ Auth proxy allows authenticated users to access sandbox apps
✅ Full create-to-live-URL flow completes in < 3 minutes
✅ API runs locally with `pnpm dev` and on Cloud Run
```

---

# WAVE 2 — Versioning, Rollback, TTL Cleanup

**Goal:** Multiple versions per sandbox. Instant rollback. Automatic TTL enforcement.

**Duration:** Week 3-4

## Task 2.1 — Version Service

### `apps/api/src/services/version.service.ts`

```typescript
interface VersionService {
  deploy(params: {
    sandboxId: string;
    sourceBuffer: Buffer;
    label?: string;
    migrationSql?: string;
    deployedBy: string;
  }): Promise<Version>;

  rollback(params: {
    sandboxId: string;
    targetVersion?: number;  // default: previous live version
  }): Promise<Version>;

  list(sandboxId: string): Promise<Version[]>;

  get(sandboxId: string, versionNumber: number): Promise<Version | null>;

  getSourceDownloadUrl(versionId: string): Promise<string>;  // Signed GCS URL
}
```

**`deploy` flow:**
```
1. Get sandbox from DB
2. Compute next version number (current_version + 1)
3. Insert version row (status: "building")
4. Upload source snapshot to GCS
5. Detect runtime (or reuse sandbox.runtime if unchanged)
6. Trigger Cloud Build
7. On success:
   a. Deploy new Cloud Run revision
   b. Shift 100% traffic to new revision
   c. Update version status to "live"
   d. Update previous live version to "rolled_back"
   e. Update sandbox.current_version
8. On failure:
   a. Update version status to "failed"
   b. Store build error summary
   c. Keep traffic on previous version
9. Return version
```

**`rollback` flow:**
```
1. Get sandbox + all versions
2. Find target version (must have status "rolled_back" and a valid revision)
3. Call cloudRunService.shiftTraffic(targetVersion.cloud_run_revision)
4. Update version statuses:
   - Target version → "live"
   - Current live version → "rolled_back"
5. Update sandbox.current_version
6. Return target version
```

## Task 2.2 — Cleanup Service (TTL Enforcement)

### `apps/api/src/services/cleanup.service.ts`

```typescript
interface CleanupService {
  // Called by Cloud Scheduler every 15 minutes
  runCleanupCycle(): Promise<CleanupReport>;

  // Send expiry notifications
  sendExpiryNotifications(): Promise<void>;

  // Transition expired sandboxes to "sleeping"
  sleepExpiredSandboxes(): Promise<void>;

  // Permanently destroy sandboxes sleeping for > 7 days
  destroySleepingSandboxes(): Promise<void>;
}

interface CleanupReport {
  notified_72h: number;
  notified_24h: number;
  slept: number;
  destroyed: number;
  errors: string[];
}
```

**Cleanup endpoint** (called by Cloud Scheduler):
```typescript
// POST /api/internal/cleanup (authenticated via Cloud Scheduler OIDC token)
app.post("/api/internal/cleanup", async (c) => {
  const report = await cleanupService.runCleanupCycle();
  return c.json(report);
});
```

**Graceful expiry flow (from SPEC-v2 §18.8):**
```
1. Query: expires_at < now() + 72h AND NOT expiry_notified_72h
   → Send "expiring in 3 days" notification, set flag

2. Query: expires_at < now() + 24h AND NOT expiry_notified_24h
   → Send "expiring tomorrow" notification, set flag

3. Query: expires_at < now() AND state = "running"
   → Set state to "sleeping"
   → Scale Cloud Run to 0 instances (set min-instances=0, max-instances=0)
   → Keep source snapshots and DB intact

4. Query: state = "sleeping" AND expires_at < now() - 7 days
   → Execute full destroy (delete Cloud Run, Neon, GCS snapshots after 30d)
```

## Task 2.3 — Cloud Scheduler Setup

Create 3 Cloud Scheduler jobs (free tier limit):

```
Job 1: cleanup-cycle
  Schedule: */15 * * * * (every 15 min)
  Target: POST https://{api-url}/api/internal/cleanup
  Auth: OIDC token with service account

Job 2: (reserved for future use)

Job 3: (reserved for future use)
```

Setup via `gcloud` CLI:
```bash
gcloud scheduler jobs create http cleanup-cycle \
  --schedule="*/15 * * * *" \
  --uri="https://{API_URL}/api/internal/cleanup" \
  --http-method=POST \
  --oidc-service-account-email={SA_EMAIL} \
  --location=us-central1
```

## Task 2.4 — Sleeping Sandbox Page

When a sandbox is in "sleeping" state, the proxy should serve a static HTML page:

```typescript
// In proxy.ts:
// If sandbox.state === "sleeping", return a static page:
// "This sandbox has expired. [Wake up for 24h] [Download source] [Extend] [Destroy]"
// The buttons hit API endpoints to wake/extend/download/destroy.
```

### Wake-up endpoint:
```typescript
// POST /api/sandboxes/:id/wake
// 1. Set sandbox state back to "running"
// 2. Set expires_at to now() + 24h
// 3. Scale Cloud Run back up (set max-instances=2)
// 4. Return sandbox with updated TTL
```

## Wave 2 Acceptance Criteria

```
✅ POST /api/sandboxes/:id/versions deploys v2, v3, etc.
✅ Each version has its own source snapshot in GCS
✅ Each version has its own Cloud Run revision
✅ Traffic shifts to latest version on deploy
✅ POST /api/sandboxes/:id/rollback shifts traffic to previous version in < 10s
✅ Rollback does NOT create a new build (instant traffic shift)
✅ GET /api/sandboxes/:id/versions returns version timeline
✅ GET /api/sandboxes/:id/versions/:num/source returns signed download URL
✅ Cleanup scheduler runs every 15 minutes
✅ Sandboxes approaching expiry get notifications (logged, Slack deferred to Wave 3)
✅ Expired sandboxes enter "sleeping" state (not destroyed)
✅ Sleeping sandboxes show "expired" page via proxy
✅ Wake-up endpoint restores a sleeping sandbox for 24h
✅ Sleeping sandboxes are permanently destroyed after 7 additional days
```

---

# WAVE 3 — Web UI (Dashboard + Deploy + Versions)

**Goal:** Non-technical users can create sandboxes, deploy versions, and roll back via a browser.

**Duration:** Week 5-6

## Task 3.1 — SDK Package

### `packages/sdk/src/client.ts`

```typescript
export class NexusClient {
  constructor(private baseUrl: string, private token?: string) {}

  async createSandbox(config: CreateSandboxInput, source: File): Promise<Sandbox>;
  async listSandboxes(): Promise<Sandbox[]>;
  async getSandbox(id: string): Promise<Sandbox>;
  async updateSandbox(id: string, input: UpdateSandboxInput): Promise<Sandbox>;
  async destroySandbox(id: string): Promise<void>;
  async extendSandbox(id: string, ttlDays: number): Promise<Sandbox>;
  async shareSandbox(id: string, input: ShareSandboxInput): Promise<Sandbox>;

  async deployVersion(sandboxId: string, source: File, label?: string): Promise<Version>;
  async listVersions(sandboxId: string): Promise<Version[]>;
  async rollback(sandboxId: string, targetVersion?: number): Promise<Version>;

  async getBuildLog(sandboxId: string, versionNumber: number): Promise<string>;
  async getSourceDownloadUrl(sandboxId: string, versionNumber: number): Promise<string>;
}
```

## Task 3.2 — Dashboard Page (`/`)

**Layout:** Header with logo + user avatar. Main content: grid of sandbox cards.

**Sandbox card component** (`components/sandbox-card.tsx`):
```
┌───────────────────────────────────────┐
│ 🟢 marketing-dashboard               │
│ v3 · Deployed 2h ago by Marie         │
│                                       │
│ https://sandbox-marketing-..run.app   │
│                                       │
│ Expires in 5 days    [Open] [Deploy]  │
└───────────────────────────────────────┘
```

**Features:**
- Status badge (green=running, yellow=sleeping, gray=creating, red=failed)
- Click card → sandbox detail page
- "What do you want to ship?" hero section with drag-and-drop for instant create
- Empty state: "No sandboxes yet. Drop a ZIP to create your first one."
- Search/filter bar

## Task 3.3 — Create Sandbox Page (`/sandboxes/new`)

**Single-page flow (not wizard):**

```
┌───────────────────────────────────────────────────┐
│  Ship something new                                │
│                                                    │
│  Name: [  marketing-dashboard  ]                   │
│                                                    │
│  ┌─────────────────────────────────────┐           │
│  │                                     │           │
│  │    Drop your ZIP here               │           │
│  │    or click to browse               │           │
│  │                                     │           │
│  └─────────────────────────────────────┘           │
│                                                    │
│  Detected: Node.js (Next.js) ✅                    │
│                                                    │
│  ▸ Advanced options                                │
│    [ ] Enable database (Postgres)                  │
│    TTL: [====7 days====--------] (slider)          │
│    Access: (●) Just me  ( ) Team  ( ) Anyone       │
│                                                    │
│  [ Ship it → ]                                     │
│                                                    │
│  ── Build log ──────────────────────────           │
│  Step 1/4: Uploading source... ✅                  │
│  Step 2/4: Building image... ⏳                    │
│  > npm install                                     │
│  > added 847 packages in 12s                       │
│  ...                                               │
└───────────────────────────────────────────────────┘
```

**Components needed:**
- `deploy-dropzone.tsx` — drag-and-drop zone, accepts ZIP/tarball, shows file name + size
- `ttl-slider.tsx` — slider 1-90 days, shows human-readable "X days" label
- `build-log-stream.tsx` — real-time log stream (poll API every 2s during build)
- `status-badge.tsx` — colored badge for sandbox/version status

## Task 3.4 — Sandbox Detail Page (`/sandboxes/[id]`)

```
┌──────────────────────────────────────────────────┐
│  ← Back                                          │
│                                                   │
│  marketing-dashboard               🟢 Running    │
│                                                   │
│  https://sandbox-marketing-...run.app   [Copy 📋] │
│  [Open in new tab ↗]                              │
│                                                   │
│  v3 "Added date filters" · by Marie · 2h ago     │
│                                                   │
│  [Deploy new version]  [Share]  [Extend]          │
│                                                   │
│  ── Versions ──────────────────────────           │
│  ● v3  "Added date filters"    LIVE              │
│    Deployed 2h ago by Marie                       │
│                                                   │
│  ○ v2  "Fixed chart colors"                      │
│    Deployed yesterday                             │
│    [Roll back to this version]                    │
│                                                   │
│  ○ v1  (initial deploy)                          │
│    Deployed 3 days ago                            │
│    [Roll back to this version]                    │
│                                                   │
│  ── Settings ──────────────────────────           │
│  Expires: April 13, 2026 (5 days)  [Extend]      │
│  Access: Owner only  [Change]                     │
│  [⚠ Destroy sandbox]                             │
└──────────────────────────────────────────────────┘
```

**Components:**
- `version-timeline.tsx` — vertical timeline with version cards
- Version card: number, label, status badge, deployer, time, rollback button
- Rollback confirmation dialog ("Roll back to v2? Traffic will shift immediately.")

## Task 3.5 — Deploy Page (`/sandboxes/[id]/deploy`)

Same dropzone as create page, but for an existing sandbox. Shows:
- Current live version
- Drag-and-drop zone for new source
- Optional label field
- Real-time build log
- On success: "v{N} is live!" with link

## Task 3.6 — Share Dialog

```
┌──────────────────────────────────────┐
│  Share marketing-dashboard            │
│                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────┐ │
│  │ Just me  │ │ My team  │ │Anyone│ │
│  │  (●)     │ │  ( )     │ │ ( )  │ │
│  └──────────┘ └──────────┘ └──────┘ │
│                                       │
│  Or share with specific people:       │
│  [ marie@company.com, joe@company.com ] │
│                                       │
│  Link: https://...run.app  [Copy 📋] │
│                                       │
│  [Update access]                      │
└──────────────────────────────────────┘
```

## Wave 3 Acceptance Criteria

```
✅ Web UI renders dashboard with sandbox list
✅ Create flow: drag ZIP → auto-detect runtime → click "Ship it" → live URL
✅ Build log streams in real-time during create/deploy
✅ Sandbox detail page shows URL, current version, version timeline
✅ Rollback via UI: click "Roll back to v2" → confirm → instant traffic shift
✅ Deploy new version via UI: drop ZIP → build → live
✅ Share dialog updates access policy
✅ Extend TTL via UI
✅ Destroy via UI with type-to-confirm
✅ Responsive layout (works on laptop + tablet)
✅ TanStack Query for data fetching with polling for build status
```

---

# WAVE 4 — CLI + MCP Server

**Goal:** Developers can use CLI. Claude Code users can deploy via MCP tools.

**Duration:** Week 7-8

## Task 4.1 — CLI (oclif)

Create `apps/cli` as an oclif project using `@nexus/sdk`.

**Commands to implement (all use the SDK client):**

```
nexus login          → Google OAuth PKCE flow → store JWT in ~/.nexus/config.json
nexus create <name>  → prompts for source dir, or --from ./dir
nexus deploy <name>  → ZIP current dir, upload, stream build log
nexus rollback <name> → roll back to previous (or --to vN)
nexus list           → table: name, state, version, url, expires
nexus info <name>    → detailed view of sandbox + versions
nexus versions <name> → table of versions
nexus destroy <name> → confirm prompt → destroy
nexus extend <name>  → --ttl 30d
nexus share <name>   → --team | --everyone | --email a@b.com
nexus logs <name>    → --build (build log) or runtime log stream
```

**Key implementation detail for `deploy`:**
```typescript
// 1. Tar the source directory (excluding node_modules, .git, etc.)
// 2. Upload as multipart to POST /api/sandboxes/:id/versions
// 3. Poll version status, stream build log to terminal
// 4. On success: print "✅ v{N} is live at {URL}"
// 5. On failure: print "❌ Build failed: {error}" + "Full log: {logUrl}"
```

## Task 4.2 — MCP Server

### `apps/mcp-server/src/index.ts`

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({
  name: "nexus",
  version: "0.1.0",
}, {
  capabilities: { tools: {} },
});

// Register all tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    sandboxCreateTool,
    sandboxDeployTool,
    sandboxRollbackTool,
    sandboxStatusTool,
    sandboxShareTool,
    sandboxLogsTool,
    sandboxListTool,
    sandboxDestroyTool,
    sandboxExtendTool,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Route to appropriate handler based on request.params.name
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Each tool file** (e.g., `tools/sandbox-deploy.ts`) defines:
```typescript
export const sandboxDeployTool = {
  name: "sandbox_deploy",
  description: "Deploy the current directory as a new version of a sandbox. Creates the sandbox if it doesn't exist.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Sandbox name (URL-safe, lowercase)" },
      source_path: { type: "string", description: "Path to source directory to deploy" },
      label: { type: "string", description: "Optional version label" },
    },
    required: ["name", "source_path"],
  },
};

export async function handleSandboxDeploy(args: { name: string; source_path: string; label?: string }): Promise<string> {
  // 1. Tar the source_path directory
  // 2. Check if sandbox exists; if not, create it
  // 3. Upload and deploy
  // 4. Return human-readable status: "v2 is live at https://..."
}
```

**MCP config for users** (`~/.claude/claude_code_config.json`):
```json
{
  "mcpServers": {
    "nexus": {
      "command": "npx",
      "args": ["@nexus/sandbox-mcp"],
      "env": {
        "NEXUS_API_URL": "https://api.nexus.app",
        "NEXUS_TOKEN": "..."
      }
    }
  }
}
```

## Wave 4 Acceptance Criteria

```
✅ nexus login opens browser, stores token
✅ nexus create my-app --from ./my-app creates sandbox from local dir
✅ nexus deploy my-app streams build log, prints live URL
✅ nexus rollback my-app rolls back instantly
✅ nexus list shows table of sandboxes
✅ nexus destroy my-app --confirm destroys sandbox
✅ MCP server starts via stdio, lists 9 tools
✅ Claude Code can call sandbox_deploy and get back a live URL
✅ Claude Code can call sandbox_rollback
✅ Claude Code can call sandbox_status to check sandbox state
✅ Full conversation flow works: generate code → deploy → iterate → share
```

---

# WAVE 5 — Slack Bot + Notifications

**Goal:** Non-technical users can create and manage sandboxes from Slack. Expiry notifications delivered via Slack.

**Duration:** Week 9-10

## Task 5.1 — Slack App Setup

Create Slack App at api.slack.com with:
- Bot Token Scopes: `app_mentions:read`, `chat:write`, `files:read`, `im:write`
- Event Subscriptions: `app_mention`, `message.im`
- Interactive Components: enabled (for buttons)
- Socket Mode: enabled (for development; switch to HTTP for production)

## Task 5.2 — Slack Bot Implementation

### `apps/slack-bot/src/index.ts`

```typescript
import { App } from "@slack/bolt";

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// @nexus create <name>
app.message(/create\s+(\S+)/i, handleCreate);

// @nexus deploy <name>
app.message(/deploy\s+(\S+)/i, handleDeploy);

// @nexus status <name>
app.message(/status\s+(\S+)/i, handleStatus);

// @nexus rollback <name>
app.message(/rollback\s+(\S+)/i, handleRollback);

// @nexus share <name> with <emails/@channel>
app.message(/share\s+(\S+)/i, handleShare);

// @nexus extend <name> <duration>
app.message(/extend\s+(\S+)\s+(\d+d)/i, handleExtend);

// @nexus destroy <name>
app.message(/destroy\s+(\S+)/i, handleDestroy);

// Button actions (from Block Kit interactive messages)
app.action("rollback_confirm", handleRollbackConfirm);
app.action("destroy_confirm", handleDestroyConfirm);
app.action("extend_quick", handleExtendQuick);
app.action("open_sandbox", handleOpenSandbox);
```

### `apps/slack-bot/src/lib/blocks.ts`

Block Kit message builders for rich Slack messages:

```typescript
export function buildDeploySuccessMessage(sandbox: Sandbox, version: Version) {
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `✅ *${sandbox.name}* v${version.number} is live!\n${version.label ? `_${version.label}_\n` : ""}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🔗 <${sandbox.cloud_run_url}|Open sandbox>`,
        },
      },
      {
        type: "actions",
        elements: [
          { type: "button", text: { type: "plain_text", text: "🔗 Open" }, url: sandbox.cloud_run_url },
          { type: "button", text: { type: "plain_text", text: "⏪ Roll Back" }, action_id: "rollback_confirm", value: sandbox.id },
          { type: "button", text: { type: "plain_text", text: "📤 Share" }, action_id: "share_dialog", value: sandbox.id },
          { type: "button", text: { type: "plain_text", text: "⏰ Extend" }, action_id: "extend_quick", value: sandbox.id },
        ],
      },
    ],
  };
}
```

## Task 5.3 — Notification Service

### `apps/api/src/services/notification.service.ts`

```typescript
interface NotificationService {
  sendExpiryWarning(sandbox: Sandbox, hoursRemaining: number): Promise<void>;
  sendDeploySuccess(sandbox: Sandbox, version: Version): Promise<void>;
  sendDeployFailure(sandbox: Sandbox, error: string): Promise<void>;
  sendDestroyNotice(sandbox: Sandbox): Promise<void>;
}
```

Notifications go to Slack DM to the sandbox owner. If the sandbox was created from a Slack channel, also post to that channel thread.

## Wave 5 Acceptance Criteria

```
✅ @nexus create my-app (with ZIP attached) creates sandbox from Slack
✅ @nexus deploy my-app (with ZIP) deploys new version
✅ @nexus status my-app shows sandbox info with Block Kit
✅ @nexus rollback my-app rolls back with confirmation button
✅ @nexus share my-app with @channel shares with channel members
✅ @nexus destroy my-app requires confirmation reaction
✅ Build progress posted as threaded replies (⏳ Building... → ✅ Live!)
✅ Interactive buttons work (Open, Roll Back, Share, Extend)
✅ Expiry notifications sent via Slack DM (72h, 24h before expiry)
✅ Destroy notifications sent when sandbox is destroyed
```

---

# WAVE 6 — Neon Database Integration

**Goal:** Sandboxes can optionally have a Postgres database. Migrations run per version. Rollback includes DB.

**Duration:** Week 11-12

## Task 6.1 — Neon Service

### `apps/api/src/services/neon.service.ts`

```typescript
interface NeonService {
  // Create a Neon project for a sandbox
  createProject(sandboxName: string): Promise<{ projectId: string; branchId: string; connectionString: string }>;

  // Create a branch for a version's migration
  createBranch(projectId: string, branchName: string, parentBranchId: string): Promise<{ branchId: string; connectionString: string }>;

  // Apply migration SQL to a branch
  applyMigration(connectionString: string, sql: string): Promise<void>;

  // Promote a branch (make it the main branch)
  promoteBranch(projectId: string, branchId: string): Promise<void>;

  // Switch active branch (for rollback)
  switchBranch(projectId: string, branchId: string): Promise<{ connectionString: string }>;

  // Delete a project
  deleteProject(projectId: string): Promise<void>;

  // Get connection string for current active branch
  getConnectionString(projectId: string): Promise<string>;
}
```

**Implementation:** Use Neon API (`https://console.neon.tech/api/v2/`) with `NEON_API_KEY`.

## Task 6.2 — Integrate Database into Sandbox Create Flow

Update `sandbox.service.ts` create flow:
```
After step 8 (Cloud Run service created):
8.5. If database_enabled:
     a. Create Neon project → projectId, branchId, connectionString
     b. Store in sandbox row (neon_project_id, neon_branch_id, database_url)
     c. Update Cloud Run service with DATABASE_URL env var
```

## Task 6.3 — Integrate Database into Version Deploy Flow

Update `version.service.ts` deploy flow:
```
After step 5 (runtime detection):
5.5. If sandbox has database AND migration_sql provided:
     a. Create Neon branch from current main → newBranchId, newConnectionString
     b. Apply migration SQL to new branch
     c. If migration fails: delete branch, fail version, return error
     d. Store newBranchId on version row
     e. Include new DATABASE_URL in Cloud Run env vars for this revision

After step 7a (traffic shifted):
7a.5. If migration succeeded:
      a. Promote new branch to main
      b. Update sandbox.neon_branch_id
```

## Task 6.4 — Database Rollback

Update `version.service.ts` rollback flow:
```
After step 3 (Cloud Run traffic shifted):
3.5. If sandbox has database:
     a. Get target version's neon_branch_id
     b. Switch Neon active branch
     c. Update sandbox.database_url with new connection string
     d. WARN: Data written after rolled-back version may be lost
```

## Task 6.5 — Update UI for Database

- Create sandbox page: add "Enable database (Postgres)" toggle
- Sandbox detail: show database status badge (provisioning/ready)
- Deploy page: add optional "Migration SQL" textarea
- Rollback confirmation: add warning about data loss if DB exists

## Wave 6 Acceptance Criteria

```
✅ Create sandbox with database=true provisions Neon project
✅ DATABASE_URL injected into Cloud Run service
✅ Sandbox app can connect to Postgres and read/write
✅ Deploy with migration SQL creates Neon branch, applies migration
✅ Migration failure does not affect live version
✅ Successful migration promotes branch to main
✅ Rollback switches Neon branch back to previous version's branch
✅ Rollback shows data loss warning when DB exists
✅ Destroy sandbox deletes Neon project
✅ UI shows database status and migration field
```

---

# WAVE 7 — GitHub Integration + Promotion

**Goal:** Long-lived sandboxes connect to GitHub repos. Auto-deploy on push. Maturity model.

**Duration:** Week 13-14

## Task 7.1 — GitHub Service

### `apps/api/src/services/github.service.ts`

```typescript
interface GitHubService {
  // Create a repo in organization from source snapshot
  createRepoFromSnapshot(params: {
    repoName: string;
    sourceSnapshotUrl: string;
    description?: string;
  }): Promise<{ repoUrl: string; fullName: string }>;

  // Set up webhook for auto-deploy on push
  createWebhook(repoFullName: string, sandboxId: string): Promise<string>; // webhookId

  // Remove webhook
  deleteWebhook(repoFullName: string, webhookId: string): Promise<void>;

  // Handle incoming webhook push event
  handlePushEvent(payload: GitHubPushPayload): Promise<void>;
}
```

## Task 7.2 — GitHub Webhook Handler

```typescript
// POST /api/webhooks/github
// 1. Verify GitHub signature (X-Hub-Signature-256)
// 2. Parse push event
// 3. Find sandbox by github_repo
// 4. Clone repo at pushed commit → tar → deploy as new version
// 5. Label: "Auto-deploy from {branch} ({shortSha})"
```

## Task 7.3 — Promotion / Maturity Model

Add `maturity` field to sandbox schema:

```typescript
// In sandbox.service.ts:
export function computeMaturity(sandbox: Sandbox): SandboxMaturity {
  const ageDays = daysSince(sandbox.created_at);
  if (sandbox.github_repo && ageDays > 90) return "graduated";
  if (ageDays > 30) return "established";
  if (ageDays > 7) return "incubating";
  return "throwaway";
}

// POST /api/sandboxes/:id/promote
// 1. Extend TTL (to 30d or 90d)
// 2. If no repo: create one from latest source snapshot
// 3. Suggest connecting repo if not already connected
// 4. Update maturity level
```

## Task 7.4 — Update UI

- Sandbox detail: show maturity badge (Throwaway/Incubating/Established/Graduated)
- Settings page: "Connect GitHub repo" section
- Prompt banner for sandboxes > 30 days without a repo
- "Promote" button for qualifying sandboxes

## Wave 7 Acceptance Criteria

```
✅ Settings page shows "Connect GitHub repo" with repo picker
✅ Connecting a repo creates webhook for auto-deploy
✅ Push to main triggers new version deployment
✅ Auto-created versions labeled "Auto-deploy from main (abc1234)"
✅ "Promote" creates GitHub repo from source snapshot if none exists
✅ Maturity badge shows on sandbox detail
✅ Sandboxes > 30 days without repo show soft prompt
✅ Graduated sandboxes have no TTL (permanent)
✅ Disconnect repo removes webhook
```

---

# WAVE 8 — Admin Panel + Observability + Polish

**Goal:** Platform admins have full visibility. Build error UX improved. Production hardening.

**Duration:** Week 15-16

## Task 8.1 — Admin Panel (`/admin`)

Protected route, only accessible to platform admins (based on email allowlist in config).

**Screens:**
- **Global dashboard:** total sandboxes by state, total versions, builds today
- **Sandbox list:** all sandboxes (all users), filterable by owner/team/state/age
- **Force destroy:** admin can destroy any sandbox
- **Quota management:** set per-user/team limits
- **Audit log viewer:** searchable table of all API actions

## Task 8.2 — Audit Log Middleware

### `apps/api/src/middleware/audit-log.ts`

```typescript
// Middleware that logs every mutating API call to audit_logs table:
// - actor_email (from auth context)
// - action (e.g., "sandbox.create", "version.deploy", "sandbox.destroy")
// - resource_type + resource_id
// - request details (sanitized, no secrets)
// - IP address, user agent
```

## Task 8.3 — Smart Build Error Messages

When a build fails, parse the Cloud Build log and generate a human-readable error:

```typescript
interface BuildErrorParser {
  parse(log: string): {
    summary: string;          // "Your app is missing a start command"
    category: string;         // "missing_start_script" | "dependency_error" | "port_mismatch" | etc.
    suggestion: string;       // "Add a 'start' script to your package.json"
    autoFixable: boolean;     // Can we fix this automatically?
  };
}
```

**Common patterns to detect:**
- `npm ERR! missing script: start` → "Add `\"start\": \"node index.js\"` to package.json scripts"
- `ENOENT: no such file or directory` → "File not found: {path}. Check your file paths."
- `ModuleNotFoundError` → "Missing dependency: {module}. Run `npm install {module}`"
- `port already in use` / EXPOSE mismatch → "Port mismatch: app listens on {X}, Dockerfile exposes {Y}"
- Python `ModuleNotFoundError` → "Missing Python package: {pkg}. Add it to requirements.txt"

## Task 8.4 — Build Log Streaming (SSE)

Replace polling with Server-Sent Events for real-time build log:

```typescript
// GET /api/sandboxes/:id/versions/:num/logs/stream
// Returns SSE stream:
// event: log
// data: {"line": "Step 1/4: npm install", "timestamp": "..."}
//
// event: status
// data: {"status": "building" | "live" | "failed"}
//
// event: done
// data: {"version": 3, "status": "live", "url": "..."}
```

## Task 8.5 — Error Recovery UX

When build fails, the Web UI shows:
```
┌─────────────────────────────────────────────────┐
│  ❌ Build failed                                 │
│                                                  │
│  What happened:                                  │
│  Your app doesn't have a "start" command.        │
│  We looked for a "start" script in package.json  │
│  but couldn't find one.                          │
│                                                  │
│  How to fix:                                     │
│  Add this to your package.json:                  │
│  "scripts": { "start": "node server.js" }        │
│                                                  │
│  [Try again with fix applied]  [Upload fixed]    │
│  [View full build log]                           │
└─────────────────────────────────────────────────┘
```

The "Try again with fix applied" button auto-patches the source and re-deploys.

## Task 8.6 — Dockerfile for Web UI

Create `apps/web/Dockerfile` for deploying Next.js to Cloud Run.

## Task 8.7 — Production Hardening

- Rate limiting on API (Hono rate-limit middleware)
- Request size limits (100 MB for source uploads)
- CORS configuration
- Helmet-style security headers
- Graceful shutdown handling
- Health check endpoint with DB connectivity check
- Structured JSON logging (for Cloud Logging)

## Wave 8 Acceptance Criteria

```
✅ Admin panel shows global dashboard with sandbox stats
✅ Admin can view all sandboxes, force-destroy any sandbox
✅ Audit log captures all mutating API calls
✅ Audit log viewer with search and filters
✅ Build failures show human-readable error messages
✅ Build failures suggest specific fixes
✅ "Try again with fix applied" auto-patches and re-deploys
✅ Build logs stream in real-time via SSE
✅ API has rate limiting, size limits, security headers
✅ Both API and Web UI deploy to Cloud Run via Dockerfile
✅ Structured JSON logs in Cloud Logging
```

---

# WAVE 9 — Cloudflare Zero Trust (Production Readiness)

**Goal:** Replace Cloud Run IAM with Cloudflare Zero Trust. Custom domain. Production-grade access control.

**Duration:** When domain is purchased and ready for production deployment.

**Note:** This wave is intentionally deferred. All previous waves work with Cloud Run IAM. This wave is the final step before opening the platform to all team members.

## Task 9.1 — Access Service (Cloudflare)

### `apps/api/src/services/access.service.ts`

```typescript
interface AccessService {
  // Create Cloudflare Access Application for a sandbox
  createAccessApp(params: {
    sandboxName: string;
    cloudRunUrl: string;
    accessMode: AccessMode;
    allowedEmails?: string[];
  }): Promise<{ accessAppId: string; hostname: string }>;

  // Update access policy
  updateAccessPolicy(accessAppId: string, params: {
    accessMode: AccessMode;
    allowedEmails?: string[];
  }): Promise<void>;

  // Delete access app
  deleteAccessApp(accessAppId: string): Promise<void>;
}
```

**Implementation:** Use Cloudflare API v4 to:
1. Create Access Application with policy
2. Add tunnel route: `{name}.nexus.app` → Cloud Run URL
3. Create DNS CNAME record

## Task 9.2 — Update All Services

Replace IAM-based access control with Cloudflare in:
- `sandbox.service.ts` create/destroy flows
- `version.service.ts` share flow
- Auth middleware (validate `Cf-Access-Jwt-Assertion` header)
- Remove proxy routes (Cloudflare handles proxying)

## Task 9.3 — Tunnel Setup

Deploy `cloudflared` connector in GCP:
- Cloud Run service running `cloudflare/cloudflared` image
- Connected to Cloudflare Tunnel
- Routes `*.nexus.app` to appropriate Cloud Run services

## Wave 9 Acceptance Criteria

```
✅ New sandboxes get {name}.nexus.app hostname
✅ Cloudflare Zero Trust enforces SSO on all sandbox access
✅ Access policy changes reflected in Cloudflare within seconds
✅ Tunnel routes traffic correctly to Cloud Run services
✅ Destroy removes Cloudflare Access app + DNS record
✅ No sandbox is accessible without Cloudflare authentication
```

---

# Deployment Checklist (Per Wave)

After each wave, before moving to the next:

```
□ All acceptance criteria pass
□ pnpm build succeeds
□ pnpm test passes
□ pnpm lint passes
□ GitHub Actions CI green
□ API deployed to Cloud Run and accessible
□ Web UI deployed to Cloud Run and accessible
□ No regressions in previous wave functionality
□ Environment variables documented in .env.example
□ Any new GCP resources documented (buckets, scheduler jobs, etc.)
```

---

# GCP Resources to Create (One-Time Setup)

Before Wave 1, create these GCP resources manually or via gcloud CLI:

```bash
# Set project
export PROJECT_ID=nexus-dev
gcloud config set project $PROJECT_ID

# Enable APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudtasks.googleapis.com \
  secretmanager.googleapis.com

# Create Artifact Registry repo
gcloud artifacts repositories create sandboxes \
  --repository-format=docker \
  --location=us-central1

# Create GCS bucket for source snapshots
gcloud storage buckets create gs://nexus-snapshots \
  --location=us-central1

# Grant Cloud Build permission to push to Artifact Registry
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Grant Cloud Build permission to deploy to Cloud Run
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"
```

---

# Summary: Wave → Deliverable → Duration

| Wave | Deliverable | Duration | Running Total |
|------|-------------|----------|---------------|
| 0 | Empty monorepo, CI, scaffolding | Day 1 | Day 1 |
| 1 | Create sandbox from ZIP → live URL | Week 1-2 | 2 weeks |
| 2 | Versioning, rollback, TTL cleanup | Week 3-4 | 4 weeks |
| 3 | Web UI (dashboard, create, deploy, rollback) | Week 5-6 | 6 weeks |
| 4 | CLI + MCP server (Claude Code integration) | Week 7-8 | 8 weeks |
| 5 | Slack bot + notifications | Week 9-10 | 10 weeks |
| 6 | Neon database integration | Week 11-12 | 12 weeks |
| 7 | GitHub integration + promotion model | Week 13-14 | 14 weeks |
| 8 | Admin panel + observability + polish | Week 15-16 | 16 weeks |
| 9 | Cloudflare Zero Trust (when domain ready) | When ready | — |

**Every wave produces a shippable increment.** After Wave 2, you have a working platform. Everything after that adds surfaces and features.
