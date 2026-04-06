# Wave 6 — Neon Database Integration

**Goal:** Sandboxes can optionally have a Postgres database. Migrations run per version with branch-per-version safety. Rollback includes DB.

**Duration:** Week 11-12
**Depends on:** Wave 2 complete

---

## W6-001: Install Neon API Client

**Depends on:** W1-003
**Files:** `apps/api/package.json`

### Steps
Add `@neondatabase/api-client` (or use raw fetch with Neon API v2) as dependency. Add `NEON_API_KEY` to config schema.

### Acceptance Criteria
- [x] Neon API client dependency added
- [x] `NEON_API_KEY` added to config Zod schema (optional, for testing without DB)
- [x] TypeScript compiles

---

## W6-002: Neon Service — Create Project

**Depends on:** W6-001
**Files:** `apps/api/src/services/neon.service.ts`

### Steps
Implement `createProject(sandboxName)`: call Neon API to create a new project named `sandbox-{name}`. Return `{ projectId, branchId, connectionString }`.

### Acceptance Criteria
- [x] Calls Neon API `POST /projects` with correct name
- [x] Project name follows `sandbox-{sandboxName}` pattern
- [x] Returns `projectId` (Neon project ID)
- [x] Returns `branchId` (main branch ID)
- [x] Returns `connectionString` (full postgres:// URL with credentials)
- [x] Handles Neon API errors with descriptive messages
- [x] Respects free tier limit (logs warning if approaching 10 projects)

---

## W6-003: Neon Service — Create Branch

**Depends on:** W6-002
**Files:** `apps/api/src/services/neon.service.ts`

### Steps
Implement `createBranch(projectId, branchName, parentBranchId)`: create a Neon branch from parent. Return `{ branchId, connectionString }`.

### Acceptance Criteria
- [x] Calls Neon API `POST /projects/{id}/branches`
- [x] Branch name follows pattern `v{version}-migration`
- [x] Created from specified parent branch
- [x] Returns new branch ID and connection string
- [x] Branch is a full copy-on-write clone (Neon behavior)

---

## W6-004: Neon Service — Apply Migration

**Depends on:** W6-003
**Files:** `apps/api/src/services/neon.service.ts`

### Steps
Implement `applyMigration(connectionString, sql)`: connect to the branch's database, execute the migration SQL within a transaction.

### Acceptance Criteria
- [x] Connects to branch using provided connection string
- [x] Executes SQL within a transaction
- [x] Rolls back transaction on SQL error
- [x] Returns void on success
- [x] Throws with SQL error details on failure
- [x] Connection closed after execution

---

## W6-005: Neon Service — Promote & Switch Branch

**Depends on:** W6-003
**Files:** `apps/api/src/services/neon.service.ts`

### Steps
1. `promoteBranch(projectId, branchId)`: set branch as primary (Neon API)
2. `switchBranch(projectId, branchId)`: get connection string for a specific branch

### Acceptance Criteria
- [x] `promoteBranch` calls Neon API to set branch as primary
- [x] `switchBranch` returns `{ connectionString }` for the specified branch
- [x] Both handle API errors with descriptive messages

---

## W6-006: Neon Service — Delete Project

**Depends on:** W6-002
**Files:** `apps/api/src/services/neon.service.ts`

### Steps
Implement `deleteProject(projectId)`: call Neon API to delete project and all branches.

### Acceptance Criteria
- [x] Calls Neon API `DELETE /projects/{id}`
- [x] Idempotent (no error if already deleted)
- [x] All branches and data deleted

---

## W6-007: Neon Service — Get Connection String

**Depends on:** W6-002
**Files:** `apps/api/src/services/neon.service.ts`

### Steps
Implement `getConnectionString(projectId)`: get connection string for current primary branch.

### Acceptance Criteria
- [x] Returns full `postgresql://` connection string
- [x] Returns string for the primary/active branch
- [x] Handles project not found

---

## W6-008: Integrate DB into Sandbox Create Flow

**Depends on:** W6-002, W1-019
**Files:** `apps/api/src/services/sandbox.service.ts`

### Steps
Update `create()`: after Cloud Run service created (step 8 in original flow), if `database_enabled`:
1. Create Neon project
2. Store `neon_project_id`, `neon_branch_id`, `database_url` on sandbox row
3. Update Cloud Run service env vars with `DATABASE_URL`

### Acceptance Criteria
- [x] `database_enabled: true` triggers Neon project creation
- [x] `neon_project_id` stored on sandbox row
- [x] `neon_branch_id` stored on sandbox row
- [x] `database_url` stored on sandbox row
- [x] Cloud Run service env vars include `DATABASE_URL`
- [x] `database_enabled: false` skips all DB steps (no Neon call)
- [x] Neon creation failure fails sandbox creation with descriptive error

---

## W6-009: Integrate DB into Version Deploy Flow

**Depends on:** W6-003, W6-004, W6-005, W2-001
**Files:** `apps/api/src/services/version.service.ts`

### Steps
Update `deploy()`: after runtime detection (step 5), if sandbox has DB AND `migration_sql` provided:
1. Create Neon branch from current main
2. Apply migration SQL to new branch
3. If migration fails: delete branch, fail version, return error
4. Store `neon_branch_id` on version row
5. Include new `DATABASE_URL` in Cloud Run env vars for this revision

After traffic shifted (step 7a): promote new branch to main, update `sandbox.neon_branch_id`.

### Acceptance Criteria
- [x] Deploy with `migration_sql` creates Neon branch
- [x] Migration SQL applied to new branch (not main)
- [x] Migration failure: branch deleted, version fails, traffic stays on previous version
- [x] Migration success: branch promoted to main after traffic shift
- [x] `version.neon_branch_id` recorded
- [x] `sandbox.neon_branch_id` updated to new branch
- [x] Deploy without `migration_sql` skips all DB steps
- [x] Deploy for sandbox without DB skips all DB steps

---

## W6-010: Integrate DB into Rollback Flow

**Depends on:** W6-005, W2-002
**Files:** `apps/api/src/services/version.service.ts`

### Steps
Update `rollback()`: after Cloud Run traffic shifted (step 3), if sandbox has DB:
1. Get target version's `neon_branch_id`
2. Switch Neon active branch to target version's branch
3. Update `sandbox.database_url` with new connection string

### Acceptance Criteria
- [x] Rollback switches Neon branch to target version's branch
- [x] `sandbox.database_url` updated with new connection string
- [x] Cloud Run env vars updated with new `DATABASE_URL`
- [x] Rollback for sandbox without DB skips DB steps

---

## W6-011: Integrate DB into Destroy Flow

**Depends on:** W6-006, W1-020
**Files:** `apps/api/src/services/sandbox.service.ts`

### Steps
Update `destroy()`: if sandbox has `neon_project_id`, delete Neon project before setting state to `"destroyed"`.

### Acceptance Criteria
- [x] Destroy deletes Neon project if it exists
- [x] Neon deletion failure logged but doesn't block sandbox destruction
- [x] Sandbox without DB skips Neon deletion

---

## W6-012: Update UI — Create Page DB Toggle

**Depends on:** W3-013
**Files:** `apps/web/src/app/sandboxes/new/page.tsx`

### Steps
Add "Enable database (Postgres)" checkbox to advanced options in create page.

### Acceptance Criteria
- [x] Checkbox labeled "Enable database (Postgres)" in advanced options
- [x] Default unchecked
- [x] When checked, includes `database: true` in create API call
- [x] Shows brief info text: "A dedicated Postgres database will be provisioned"

---

## W6-013: Update UI — Sandbox Detail DB Info

**Depends on:** W3-015
**Files:** `apps/web/src/app/sandboxes/[id]/page.tsx`

### Steps
Show database status on sandbox detail page: badge (provisioning/ready), connection info hint.

### Acceptance Criteria
- [x] Shows "Database: Postgres" with status badge if DB enabled
- [x] Shows "No database" if DB not enabled
- [x] Status badge: green=ready, yellow=provisioning

---

## W6-014: Update UI — Deploy Page Migration SQL

**Depends on:** W3-016
**Files:** `apps/web/src/app/sandboxes/[id]/deploy/page.tsx`

### Steps
1. Add optional "Migration SQL" textarea on deploy page (only if sandbox has DB)
2. Add data loss warning to rollback confirmation dialog for sandboxes with DB

### Acceptance Criteria
- [x] Migration SQL textarea visible only for sandboxes with `database_enabled: true`
- [x] Textarea label: "Migration SQL (optional)"
- [x] Textarea placeholder: "ALTER TABLE ... ADD COLUMN ..."
- [x] SQL included in deploy API call as `migration_sql`
- [x] Rollback dialog for DB sandboxes shows: "Warning: Data written after v{N} may be lost"
- [x] Rollback dialog for non-DB sandboxes has no extra warning

---

## Wave 6 — Final Validation

### End-to-End Test (Manual)
```bash
# 1. Create sandbox with DB
curl -X POST .../api/sandboxes \
  -F 'config={"name":"db-test","database":true}' \
  -F 'source=@app.zip'
# 2. Verify DB provisioned (check Neon dashboard)
# 3. App can connect to DB (deploy app that reads/writes to DATABASE_URL)
# 4. Deploy v2 with migration
curl -X POST .../api/sandboxes/{id}/versions \
  -F 'config={"migration_sql":"CREATE TABLE items (id serial PRIMARY KEY, name text)"}' \
  -F 'source=@v2.zip'
# 5. Verify migration applied
# 6. Rollback to v1 → verify Neon branch switched
# 7. Destroy → verify Neon project deleted
```

### Wave 6 Complete Criteria
- [x] All 14 tasks pass acceptance criteria
- [x] Create with `database: true` provisions Neon project
- [x] `DATABASE_URL` injected into Cloud Run service
- [x] App connects to Postgres and reads/writes
- [x] Deploy with migration creates branch, applies SQL
- [x] Migration failure keeps traffic on previous version
- [x] Rollback switches Neon branch
- [x] Destroy deletes Neon project
- [x] UI shows DB toggle, status, migration field, rollback warning

---
**Status: DONE**
