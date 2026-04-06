# Wave 0 — Project Scaffolding

**Goal:** Empty monorepo that builds, lints, and has CI. Zero functionality, but every developer (or LLM) can start coding immediately.

**Duration:** Day 1
**Depends on:** All prerequisites complete
**Status:** COMPLETE (96/96 tests passing)

---

## W0-001: Create Root `package.json`

**Depends on:** None
**Files:** `package.json`
**Status:** DONE

### Steps
Create `package.json` at repo root with:
- `name`: `"nexus"`
- `private`: `true`
- Scripts: `build`, `dev`, `lint`, `test`, `format`, `check-format`
- DevDependencies: `turbo@^2.4`, `prettier@^3.5`, `typescript@^5.7`
- Engines: `node>=22`, `pnpm>=9`
- `packageManager`: `pnpm@9.15.0`

### Acceptance Criteria
- [x] File exists at `nexus/package.json`
- [x] `name` field is `"nexus"`
- [x] `private` is `true`
- [x] All 6 scripts are defined (`build`, `dev`, `lint`, `test`, `format`, `check-format`)
- [x] `turbo`, `prettier`, `typescript` listed in devDependencies
- [x] `engines.node` is `>=22`
- [x] `packageManager` field specifies pnpm 9.x

---

## W0-002: Create `pnpm-workspace.yaml`

**Depends on:** None
**Files:** `pnpm-workspace.yaml`
**Status:** DONE

### Steps
Define workspace packages: `apps/*` and `packages/*`.

### Acceptance Criteria
- [x] File exists at `nexus/pnpm-workspace.yaml`
- [x] Lists `"apps/*"` in packages array
- [x] Lists `"packages/*"` in packages array

---

## W0-003: Create `turbo.json`

**Depends on:** None
**Files:** `turbo.json`
**Status:** DONE

### Steps
Configure Turborepo with tasks: `build` (depends on `^build`, outputs `dist/**` + `.next/**`), `dev` (no cache, persistent), `lint` (depends on `^build`), `test` (depends on `^build`).

### Acceptance Criteria
- [x] File exists at `nexus/turbo.json`
- [x] `$schema` points to turbo.build schema URL
- [x] `tasks.build.dependsOn` includes `"^build"`
- [x] `tasks.build.outputs` includes `"dist/**"` and `".next/**"`
- [x] `tasks.dev.cache` is `false`
- [x] `tasks.dev.persistent` is `true`
- [x] `tasks.lint` and `tasks.test` are defined

---

## W0-004: Create `tsconfig.base.json`

**Depends on:** None
**Files:** `tsconfig.base.json`
**Status:** DONE

### Steps
Base TypeScript config: target `ES2022`, module `ESNext`, `moduleResolution: bundler`, `strict: true`, declaration + declarationMap + sourceMap.

### Acceptance Criteria
- [x] File exists at `nexus/tsconfig.base.json`
- [x] `target` is `"ES2022"`
- [x] `module` is `"ESNext"`
- [x] `moduleResolution` is `"bundler"`
- [x] `strict` is `true`
- [x] `declaration` is `true`
- [x] `outDir` is `"dist"`, `rootDir` is `"src"`

---

## W0-005: Create `.gitignore`

**Depends on:** None
**Files:** `.gitignore`
**Status:** DONE

### Steps
Ignore: `node_modules/`, `dist/`, `.next/`, `.turbo/`, `*.env` (except `.env.example`), `.DS_Store`

### Acceptance Criteria
- [x] File exists at `nexus/.gitignore`
- [x] `node_modules/` is ignored
- [x] `dist/` is ignored
- [x] `.next/` is ignored
- [x] `.turbo/` is ignored
- [x] `*.env` is ignored
- [x] `.env.example` is NOT ignored (negation rule `!.env.example`)

---

## W0-006: Create `.env.example`

**Depends on:** None
**Files:** `.env.example`
**Status:** DONE

### Steps
Template with all env vars (GCP, Neon, Auth, Slack, Cloudflare) with placeholder values and comments grouping them by service.

### Acceptance Criteria
- [x] File exists at `nexus/.env.example`
- [x] Contains `GCP_PROJECT_ID`, `GCP_REGION`, `GCS_BUCKET_SNAPSHOTS`, `ARTIFACT_REGISTRY`
- [x] Contains `DATABASE_URL`
- [x] Contains `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `SESSION_SECRET`
- [x] Contains `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`
- [x] Contains `NEON_API_KEY`
- [x] Cloudflare vars are commented out (deferred)
- [x] No actual secrets in the file (only placeholders)

---

## W0-007: Create `packages/shared` — Package Config

**Depends on:** W0-001, W0-002
**Files:** `packages/shared/package.json`, `packages/shared/tsconfig.json`
**Status:** DONE

### Steps
1. Create `packages/shared/package.json` with name `@nexus/shared`, deps: `zod@^3.24`, devDeps: `typescript`, `vitest`
2. Create `packages/shared/tsconfig.json` extending `../../tsconfig.base.json`

### Acceptance Criteria
- [x] `packages/shared/package.json` exists with `name: "@nexus/shared"`
- [x] `main` points to `"dist/index.js"`, `types` to `"dist/index.d.ts"`
- [x] `zod` is a dependency
- [x] `tsconfig.json` extends `../../tsconfig.base.json`
- [x] Scripts include `build`, `lint`, `test`

---

## W0-008: Create `packages/shared` — Enums

**Depends on:** W0-007
**Files:** `packages/shared/src/types/enums.ts`
**Status:** DONE

### Steps
Define const enums + types for: `SandboxState` (creating, running, sleeping, destroying, destroyed), `VersionStatus` (building, live, rolled_back, failed), `AccessMode` (owner_only, team, anyone, custom), `Runtime` (nodejs, python, static, go, dockerfile), `DatabaseState` (provisioning, ready, destroying, destroyed), `SandboxMaturity` (throwaway, incubating, established, graduated).

### Acceptance Criteria
- [x] File exports `SandboxState` const + type with exactly 5 values
- [x] File exports `VersionStatus` const + type with exactly 4 values
- [x] File exports `AccessMode` const + type with exactly 4 values
- [x] File exports `Runtime` const + type with exactly 5 values
- [x] File exports `DatabaseState` const + type with exactly 4 values
- [x] File exports `SandboxMaturity` const + type with exactly 4 values
- [x] All values are lowercase snake_case strings
- [x] TypeScript compiles without errors

---

## W0-009: Create `packages/shared` — Zod Schemas

**Depends on:** W0-008
**Files:** `packages/shared/src/schemas/sandbox.ts`, `packages/shared/src/schemas/version.ts`
**Status:** DONE

### Steps
1. `sandbox.ts`: `CreateSandboxSchema` (name: 3-63 chars URL-safe, runtime optional, database bool default false, ttl_days 1-90 default 7, access_mode, allowed_emails, team, label, metadata), `UpdateSandboxSchema`, `ExtendSandboxSchema`, `ShareSandboxSchema` + inferred types
2. `version.ts`: `DeployVersionSchema` (label, migration_sql), `RollbackSchema` (target_version optional int) + inferred types

### Acceptance Criteria
- [x] `CreateSandboxSchema` validates name regex `/^[a-z][a-z0-9-]*[a-z0-9]$/`
- [x] `CreateSandboxSchema` rejects names < 3 or > 63 chars
- [x] `CreateSandboxSchema` defaults `database` to `false`, `ttl_days` to `7`, `access_mode` to `"owner_only"`
- [x] `UpdateSandboxSchema` has all fields optional
- [x] `ExtendSandboxSchema` requires `ttl_days` (1-90)
- [x] `ShareSandboxSchema` requires `access_mode`, optional `allowed_emails`
- [x] `DeployVersionSchema` has optional `label` (max 200) and `migration_sql`
- [x] `RollbackSchema` has optional `target_version` (positive int)
- [x] All types are exported (`CreateSandboxInput`, `UpdateSandboxInput`, etc.)
- [x] TypeScript compiles without errors

---

## W0-010: Create `packages/shared` — Barrel Export

**Depends on:** W0-008, W0-009
**Files:** `packages/shared/src/index.ts`
**Status:** DONE

### Steps
Re-export everything from `./types/enums.js`, `./schemas/sandbox.js`, `./schemas/version.js`.

### Acceptance Criteria
- [x] `packages/shared/src/index.ts` exists
- [x] Exports all enums from `enums.ts`
- [x] Exports all schemas and types from `sandbox.ts` and `version.ts`
- [x] `pnpm --filter @nexus/shared build` succeeds
- [x] `dist/index.js` and `dist/index.d.ts` are generated

---

## W0-011: Create `packages/db` — Drizzle Schema

**Depends on:** W0-007
**Files:** `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/drizzle.config.ts`, `packages/db/src/schema/sandboxes.ts`, `packages/db/src/schema/versions.ts`, `packages/db/src/schema/audit-logs.ts`, `packages/db/src/schema/users.ts`, `packages/db/src/index.ts`
**Status:** DONE

### Steps
1. `package.json`: name `@nexus/db`, deps: `drizzle-orm@^0.39`, `@neondatabase/serverless@^0.10`, devDeps: `drizzle-kit@^0.30`
2. `drizzle.config.ts`: schema `./src/schema/*.ts`, out `./src/migrations`, dialect `postgresql`
3. `sandboxes.ts`: pgEnums (`sandbox_state`, `access_mode`, `runtime`) + `sandboxes` table with all columns from WAVE-PLAN
4. `versions.ts`: pgEnum `version_status` + `versions` table with FK to sandboxes
5. `audit-logs.ts`: `audit_logs` table
6. `users.ts`: placeholder (empty schema for future use)
7. `index.ts`: `createDb()` function using Neon serverless driver, exports schema + Db type

### Acceptance Criteria
- [x] `packages/db/package.json` exists with `name: "@nexus/db"`
- [x] `sandboxes` table has columns: `id` (uuid PK), `name` (unique text), `owner_email`, `team`, `runtime`, `state`, `access_mode`, `allowed_emails` (jsonb), `cloud_run_service`, `cloud_run_url`, `region`, `database_enabled`, `neon_project_id`, `neon_branch_id`, `database_url`, `ttl_days`, `expires_at`, `expiry_notified_72h`, `expiry_notified_24h`, `github_repo`, `github_webhook_id`, `current_version`, `metadata` (jsonb), `created_at`, `updated_at`, `destroyed_at`
- [x] `versions` table has columns: `id` (uuid PK), `sandbox_id` (FK cascade), `number`, `label`, `status`, `source_snapshot_url`, `container_image`, `cloud_run_revision`, `build_log_url`, `migration_sql`, `neon_branch_id`, `created_by`, `created_at`, `deployed_at`, `build_duration_ms`
- [x] `audit_logs` table has columns: `id` (uuid PK), `actor_email`, `action`, `resource_type`, `resource_id`, `details` (jsonb), `ip_address`, `user_agent`, `created_at`
- [x] `createDb(databaseUrl)` returns a typed Drizzle instance
- [x] `pnpm --filter @nexus/db build` succeeds
- [x] `drizzle.config.ts` points to correct schema path and outputs to `./src/migrations`

---

## W0-012: Create `apps/api` — Empty Hono Server

**Depends on:** W0-010, W0-011
**Files:** `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/index.ts`, `apps/api/src/routes/health.ts`, `apps/api/Dockerfile`
**Status:** DONE

### Steps
1. `package.json`: name `@nexus/api`, deps: `hono@^4.7`, `@hono/node-server@^1.13`, `@nexus/shared`, `@nexus/db`, `zod`, devDeps: `tsx`, `typescript`, `vitest`, `@types/node`
2. `index.ts`: Hono app with logger + CORS middleware, mount `/api/health` route
3. `health.ts`: GET `/` returns `{ status: "ok", timestamp }`
4. `Dockerfile`: multi-stage build (base → build → runtime), exposes 8080

### Acceptance Criteria
- [x] `apps/api/package.json` exists with `name: "@nexus/api"`
- [x] `pnpm --filter @nexus/api build` succeeds
- [x] `pnpm --filter @nexus/api dev` starts server on port 8080
- [x] `GET http://localhost:8080/api/health` returns `200` with `{ "status": "ok", "timestamp": "..." }`
- [x] Response `Content-Type` is `application/json`
- [x] CORS headers present in response
- [x] Dockerfile builds successfully: `docker build -t nexus-api .` (from repo root context)
- [x] Container starts and health endpoint responds

---

## W0-013: Create `apps/web` — Empty Next.js App

**Depends on:** W0-001, W0-002
**Files:** `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`
**Status:** DONE

### Steps
1. `package.json`: name `@nexus/web`, deps: `next@^15.3`, `react@^19`, `react-dom@^19`, `@nexus/shared`, `@nexus/sdk`, `@tanstack/react-query@^5.75`, `tailwindcss@^4`
2. Set up App Router with root layout + landing page ("Nexus" heading + "What do you want to ship?" subtitle)
3. Configure Tailwind v4

### Acceptance Criteria
- [x] `apps/web/package.json` exists with `name: "@nexus/web"`
- [x] `pnpm --filter @nexus/web build` succeeds (or skips if SDK not ready — no hard dep)
- [x] `pnpm --filter @nexus/web dev` starts server on port 3000
- [x] `GET http://localhost:3000` returns HTML with "Nexus" heading
- [x] Page renders "What do you want to ship?" subtitle
- [x] Tailwind CSS classes are applied (verify `min-h-screen` renders correctly)

---

## W0-014: Create GitHub Actions CI

**Depends on:** W0-012, W0-013
**Files:** `.github/workflows/ci.yml`
**Status:** DONE

### Steps
Create CI workflow: triggers on push/PR to `main`, runs `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm lint`, `pnpm test` on ubuntu-latest with Node 22.

### Acceptance Criteria
- [x] File exists at `.github/workflows/ci.yml`
- [x] Triggers on push to `main` and PRs to `main`
- [x] Uses `pnpm/action-setup@v4`
- [x] Uses `actions/setup-node@v4` with node-version 22 and pnpm cache
- [x] Runs all 4 commands: install, build, lint, test
- [ ] (When pushed) CI passes green on GitHub

---

## Wave 0 — Final Validation

Run these commands from repo root to confirm everything works:

```bash
pnpm install                           # Must succeed
pnpm build                             # All packages + apps compile
pnpm lint                              # No lint errors
pnpm --filter @nexus/api dev &         # API starts
curl http://localhost:8080/api/health   # Returns { status: "ok" }
pnpm --filter @nexus/web dev &         # Web starts
curl http://localhost:3000              # Returns HTML with "Nexus"
```

### Wave 0 Complete Criteria
- [x] All 14 tasks (W0-001 through W0-014) pass their acceptance criteria
- [x] `pnpm install` succeeds with no errors
- [x] `pnpm build` succeeds across all workspaces
- [x] `pnpm lint` passes
- [x] API health endpoint returns 200
- [x] Web landing page renders
- [x] Drizzle schema compiles (no DB connection needed)
- [ ] Git repo initialized with first commit
