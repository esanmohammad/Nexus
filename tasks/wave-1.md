# Wave 1 — Core API + Build Pipeline

**Goal:** Create a sandbox from a ZIP upload, build a container, deploy to Cloud Run, get a live URL.

**Duration:** Week 1-2
**Depends on:** Wave 0 complete, all prerequisites complete
**Status:** COMPLETE (110/110 tests passing)

---

## W1-001: Config Loader (`config.ts`)

**Depends on:** W0-012
**Files:** `apps/api/src/lib/config.ts`
**Status:** DONE

### Steps
Create a Zod-validated config loader that parses `process.env` into a typed config object. Fields: `PORT` (number, default 8080), `GCP_PROJECT_ID` (required string), `GCP_REGION` (default "us-central1"), `GCS_BUCKET_SNAPSHOTS` (required), `ARTIFACT_REGISTRY` (required), `DATABASE_URL` (required), `JWT_SECRET` (required), `NODE_ENV` (enum, default "development").

### Acceptance Criteria
- [x] `config.ts` exports a `config` object and `Config` type
- [x] Missing required vars throw a Zod validation error at startup
- [x] `PORT` coerces string to number
- [x] `NODE_ENV` only accepts "development", "production", "test"
- [x] TypeScript compiles without errors

---

## W1-002: GCP Client Initialization (`gcp.ts`)

**Depends on:** W1-001
**Files:** `apps/api/src/lib/gcp.ts`
**Status:** DONE

### Steps
Initialize and export GCP clients: `CloudBuildClient`, `ServicesClient` (Cloud Run), `RevisionsClient` (Cloud Run), `Storage` (GCS). Export `getSnapshotsBucket()` helper.

### Acceptance Criteria
- [x] File exports `cloudBuild`, `cloudRunServices`, `cloudRunRevisions`, `storage`
- [x] File exports `getSnapshotsBucket()` returning a GCS bucket handle
- [x] All imports resolve (`@google-cloud/cloudbuild`, `@google-cloud/run`, `@google-cloud/storage`)
- [x] TypeScript compiles without errors

---

## W1-003: Install GCP Dependencies

**Depends on:** W0-012
**Files:** `apps/api/package.json`
**Status:** DONE

### Steps
Add dependencies: `@google-cloud/cloudbuild`, `@google-cloud/run`, `@google-cloud/storage`, `google-auth-library`.

### Acceptance Criteria
- [x] All 4 packages listed in `apps/api/package.json` dependencies
- [x] `pnpm install` succeeds
- [x] Imports resolve in TypeScript

---

## W1-004: Storage Service — Upload Snapshot

**Depends on:** W1-002
**Files:** `apps/api/src/services/storage.service.ts`
**Status:** DONE

### Steps
Implement `uploadSnapshot(sandboxName, version, buffer)`:
1. Validate buffer size ≤ 100 MB
2. Upload to `gs://{bucket}/{sandboxName}/v{version}/source.tar.gz`
3. Set metadata: `sandbox`, `version`, `uploaded_at`
4. Return full `gs://` URL

### Acceptance Criteria
- [x] Function signature: `uploadSnapshot(sandboxName: string, version: number, buffer: Buffer): Promise<string>`
- [x] Rejects buffers > 100 MB with descriptive error
- [x] Uploaded object path follows pattern `{sandboxName}/v{version}/source.tar.gz`
- [x] Object metadata includes `sandbox`, `version`, `uploaded_at` fields
- [x] Returns `gs://` URL string
- [x] Unit test: mock GCS, verify upload path and metadata

---

## W1-005: Storage Service — Download Snapshot

**Depends on:** W1-004
**Files:** `apps/api/src/services/storage.service.ts`
**Status:** DONE

### Steps
Implement `downloadSnapshot(gcsUrl)`: parse bucket/object from URL, download, return Buffer.

### Acceptance Criteria
- [x] Function signature: `downloadSnapshot(gcsUrl: string): Promise<Buffer>`
- [x] Correctly parses `gs://bucket/path` into bucket and object
- [x] Returns file contents as Buffer
- [x] Throws descriptive error if object not found

---

## W1-006: Storage Service — Delete Snapshot

**Depends on:** W1-004
**Files:** `apps/api/src/services/storage.service.ts`
**Status:** DONE

### Steps
Implement `deleteSnapshot(gcsUrl)`: parse URL, delete object from GCS.

### Acceptance Criteria
- [x] Function signature: `deleteSnapshot(gcsUrl: string): Promise<void>`
- [x] Deletes the correct object from GCS
- [x] Does not throw if object already deleted (idempotent)

---

## W1-007: Storage Service — Upload Build Log

**Depends on:** W1-004
**Files:** `apps/api/src/services/storage.service.ts`
**Status:** DONE

### Steps
Implement `uploadBuildLog(sandboxName, version, log)`: upload text to `gs://{bucket}/{sandboxName}/v{version}/build.log`.

### Acceptance Criteria
- [x] Function signature: `uploadBuildLog(sandboxName: string, version: number, log: string): Promise<string>`
- [x] Uploaded as `text/plain` content type
- [x] Returns `gs://` URL

---

## W1-008: Runtime Detection — Core Logic

**Depends on:** W0-012
**Files:** `apps/api/src/lib/runtime-detect.ts`
**Status:** DONE

### Steps
Implement `detectRuntime(files, fileContents)` with priority-ordered detection:
1. `Dockerfile` → runtime `"dockerfile"`, use file contents, parse EXPOSE for port
2. `sandbox.toml` → parse for runtime/commands/port
3. `package.json` with `next` dep → Node.js/Next.js (port 3000)
4. `package.json` with `scripts.start` → Node.js (port 8080)
5. `package.json` (any) → Node.js fallback
6. `requirements.txt` or `pyproject.toml` → Python (port 8080)
7. `go.mod` → Go (port 8080)
8. `index.html` → Static/nginx (port 8080)
9. No match → error

### Acceptance Criteria
- [x] Returns `RuntimeDetectionResult` with `runtime`, `dockerfile`, `port`, `buildCommand`, `startCommand`, `confidence`
- [x] Detects existing `Dockerfile` with "high" confidence
- [x] Detects Next.js project (package.json with `next` dependency)
- [x] Detects plain Node.js project (package.json with start script)
- [x] Detects Python project (requirements.txt)
- [x] Detects Go project (go.mod)
- [x] Detects static site (index.html)
- [x] Returns error for unrecognizable projects
- [x] Unit test: at least one test per detection path (7 tests minimum)

---

## W1-009: Runtime Detection — Dockerfile Templates

**Depends on:** W0-005
**Files:** `infra/dockerfiles/node.Dockerfile`, `infra/dockerfiles/python.Dockerfile`, `infra/dockerfiles/static.Dockerfile`, `infra/dockerfiles/go.Dockerfile`
**Status:** DONE

### Steps
Create Dockerfile templates with `{{PORT}}`, `{{BUILD_COMMAND}}`, `{{START_COMMAND}}` placeholders.

### Acceptance Criteria
- [x] `node.Dockerfile`: FROM node:22-slim, WORKDIR /app, COPY, npm ci, build, EXPOSE, CMD
- [x] `python.Dockerfile`: FROM python:3.12-slim, requirements install, gunicorn CMD
- [x] `static.Dockerfile`: FROM nginx:alpine, COPY to /usr/share/nginx/html
- [x] `go.Dockerfile`: FROM golang:1.22, go build, FROM scratch or distroless
- [x] Each template has `{{PORT}}` placeholder
- [x] Templates are valid Dockerfiles after placeholder substitution

---

## W1-010: Runtime Detection — Template Interpolation

**Depends on:** W1-008, W1-009
**Files:** `apps/api/src/lib/runtime-detect.ts`
**Status:** DONE

### Steps
Add function to read template files and substitute `{{PORT}}`, `{{BUILD_COMMAND}}`, `{{START_COMMAND}}` placeholders with detected values.

### Acceptance Criteria
- [x] `generateDockerfile(template, vars)` replaces all placeholders
- [x] No unreplaced `{{...}}` placeholders in output
- [x] Generated Dockerfile is syntactically valid
- [x] Unit test: template with all 3 placeholders produces correct output

---

## W1-011: Build Service — Trigger Build

**Depends on:** W1-002, W1-004
**Files:** `apps/api/src/services/build.service.ts`
**Status:** DONE

### Steps
Implement `triggerBuild(params)`:
1. Call `CloudBuildClient.createBuild()` with storageSource pointing to GCS snapshot
2. Build step: `gcr.io/cloud-builders/docker build -t {imageTag} .`
3. Images: push to Artifact Registry
4. Tags: `sandbox-{name}`, `v{version}`
5. Timeout: 600s

### Acceptance Criteria
- [x] Function signature matches `BuildService.triggerBuild` interface
- [x] Uses `storageSource` with correct bucket and object
- [x] Image tag format: `{ARTIFACT_REGISTRY}/{sandboxName}:v{version}`
- [x] Build timeout is 600 seconds
- [x] Returns `BuildResult` with `buildId`
- [x] Tags include sandbox name and version

---

## W1-012: Build Service — Poll Build Status

**Depends on:** W1-011
**Files:** `apps/api/src/services/build.service.ts`
**Status:** DONE

### Steps
Implement `getBuildStatus(buildId)`: call `CloudBuildClient.getBuild()`, map to `BuildStatus` (pending, building, success, failure, timeout).

### Acceptance Criteria
- [x] Function signature: `getBuildStatus(buildId: string): Promise<BuildStatus>`
- [x] Maps Cloud Build statuses to simplified enum
- [x] Returns `imageUrl` on success status

---

## W1-013: Build Service — Get Build Log

**Depends on:** W1-011
**Files:** `apps/api/src/services/build.service.ts`
**Status:** DONE

### Steps
Implement `getBuildLog(buildId)`: fetch build log from Cloud Build.

### Acceptance Criteria
- [x] Function signature: `getBuildLog(buildId: string): Promise<string>`
- [x] Returns raw build log text
- [x] Handles case where log is not yet available

---

## W1-014: Build Service — Poll Until Complete

**Depends on:** W1-012
**Files:** `apps/api/src/services/build.service.ts`
**Status:** DONE

### Steps
Implement `waitForBuild(buildId)`: poll `getBuildStatus` every 5 seconds until terminal state (success/failure/timeout). Return `BuildResult`.

### Acceptance Criteria
- [x] Polls every 5 seconds (configurable)
- [x] Stops on terminal states: SUCCESS, FAILURE, TIMEOUT, CANCELLED
- [x] Returns complete `BuildResult` with `success`, `imageUrl` (on success), `error` (on failure), `durationMs`
- [x] Has a maximum poll count to prevent infinite loops (e.g., 120 polls = 10 min)

---

## W1-015: Cloud Run Service — Create Service

**Depends on:** W1-002
**Files:** `apps/api/src/services/cloudrun.service.ts`
**Status:** DONE

### Steps
Implement `createService(params)`:
1. Create Cloud Run service named `sandbox-{name}`
2. Deploy with image URL, port, env vars
3. Set `--no-allow-unauthenticated` (IAM-based access)
4. Labels: `sandbox={name}`, `owner={email}`, `version=v{N}`
5. Resources: 1 vCPU, 512 MB memory, max 2 instances, min 0
6. Return `{ serviceUrl, revisionName }`

### Acceptance Criteria
- [x] Service name follows `sandbox-{name}` pattern
- [x] Image URL is correctly set
- [x] Port matches detected port
- [x] Service is NOT publicly accessible (requires IAM auth)
- [x] Labels include `sandbox`, `owner`, `version`
- [x] Max instances = 2, min instances = 0 (scale to zero)
- [x] Memory = 512 MB
- [x] Returns `serviceUrl` (*.run.app URL) and `revisionName`
- [x] Env vars `SANDBOX_ID`, `SANDBOX_NAME`, `VERSION`, `PORT` are injected

---

## W1-016: Cloud Run Service — Deploy Revision

**Depends on:** W1-015
**Files:** `apps/api/src/services/cloudrun.service.ts`
**Status:** DONE

### Steps
Implement `deployRevision(params)`: update existing Cloud Run service with new image, creating a new revision. Shift 100% traffic to new revision.

### Acceptance Criteria
- [x] Updates existing service (does not create new)
- [x] New revision created with new image
- [x] Traffic 100% on new revision
- [x] Returns `{ revisionName }`

---

## W1-017: Cloud Run Service — Shift Traffic

**Depends on:** W1-015
**Files:** `apps/api/src/services/cloudrun.service.ts`
**Status:** DONE

### Steps
Implement `shiftTraffic(params)`: update traffic allocation to 100% on specified revision.

### Acceptance Criteria
- [x] Shifts 100% traffic to specified revision name
- [x] Does NOT create a new revision
- [x] Completes in < 10 seconds

---

## W1-018: Cloud Run Service — Delete & Get URL

**Depends on:** W1-015
**Files:** `apps/api/src/services/cloudrun.service.ts`
**Status:** DONE

### Steps
1. `deleteService(sandboxName)`: delete Cloud Run service
2. `getServiceUrl(sandboxName)`: get the *.run.app URL for a service

### Acceptance Criteria
- [x] `deleteService` removes the Cloud Run service entirely
- [x] `deleteService` is idempotent (no error if already deleted)
- [x] `getServiceUrl` returns the URL or null if service doesn't exist

---

## W1-019: Sandbox Service — Create Orchestrator

**Depends on:** W1-004, W1-008, W1-011, W1-015, W0-011
**Files:** `apps/api/src/services/sandbox.service.ts`
**Status:** DONE

### Steps
Implement `create(input)` with the critical path:
1. Validate input (Zod)
2. Check name uniqueness in DB
3. Check user quota (max 5 active sandboxes)
4. Insert sandbox row (state: `creating`)
5. Upload source to GCS
6. Detect runtime → Dockerfile + port
7. Trigger Cloud Build → wait until done
8. On failure: update state, store error, return error
9. Create Cloud Run service
10. Insert version row (v1, status: `live`)
11. Update sandbox row (state: `running`, URL, current_version: 1)
12. Return sandbox with URL

### Acceptance Criteria
- [x] Validates input against `CreateSandboxSchema`
- [x] Rejects duplicate names with 409 error
- [x] Rejects if user has ≥ 5 active sandboxes with 429 error
- [x] Sandbox row created in DB with state `"creating"` before build starts
- [x] Source uploaded to GCS before build
- [x] Runtime detected from source contents
- [x] Build triggered and awaited
- [x] On build failure: sandbox state stays `"creating"`, error stored, version status `"failed"`
- [x] On success: Cloud Run service created, version v1 status `"live"`, sandbox state `"running"`
- [x] Returns sandbox object with `cloud_run_url`
- [x] `expires_at` calculated as `now() + ttl_days`
- [x] Full flow completes in < 3 minutes (majority is build time)

---

## W1-020: Sandbox Service — CRUD Operations

**Depends on:** W1-019
**Files:** `apps/api/src/services/sandbox.service.ts`
**Status:** DONE

### Steps
Implement: `get(id)`, `list(ownerEmail)`, `update(id, input)`, `destroy(id)`, `extend(id, ttlDays)`.

### Acceptance Criteria
- [x] `get(id)` returns sandbox or null
- [x] `list(ownerEmail)` returns only sandboxes owned by that email, excludes `destroyed`
- [x] `update(id, input)` updates only provided fields
- [x] `destroy(id)` sets state to `"destroying"`, deletes Cloud Run service, deletes GCS snapshots, sets state to `"destroyed"`, sets `destroyed_at`
- [x] `extend(id, ttlDays)` recalculates `expires_at`, resets notification flags
- [x] `extend` validates ttl_days 1-90

---

## W1-021: API Routes — Sandboxes + Versions

**Depends on:** W1-019, W1-020
**Files:** `apps/api/src/routes/sandboxes.ts`, `apps/api/src/routes/versions.ts`
**Status:** DONE

### Steps
1. `sandboxes.ts`: POST `/` (create, multipart), GET `/` (list), GET `/:id`, PATCH `/:id`, DELETE `/:id`, POST `/:id/extend`, POST `/:id/share`
2. `versions.ts`: POST `/api/sandboxes/:id/versions` (deploy), GET list, GET single, POST rollback
3. Wire both into main app (`index.ts`)

### Acceptance Criteria
- [x] POST `/api/sandboxes` accepts multipart form (config JSON + source ZIP)
- [x] POST `/api/sandboxes` returns 201 with sandbox object including URL
- [x] GET `/api/sandboxes` returns array of user's sandboxes
- [x] GET `/api/sandboxes/:id` returns sandbox with versions
- [x] PATCH `/api/sandboxes/:id` updates sandbox, returns 200
- [x] DELETE `/api/sandboxes/:id` returns 202
- [x] POST `/api/sandboxes/:id/extend` returns updated sandbox
- [x] POST `/api/sandboxes/:id/share` returns updated sandbox
- [x] POST `/api/sandboxes/:id/versions` creates new version
- [x] GET `/api/sandboxes/:id/versions` returns version list
- [x] POST `/api/sandboxes/:id/rollback` performs rollback
- [x] All routes validate request bodies with Zod
- [x] 400 returned for invalid input with Zod error messages
- [x] 404 returned for non-existent sandbox
- [x] 403 returned when user doesn't own sandbox

---

## W1-022: Auth Proxy for Sandbox Access

**Depends on:** W1-015, W1-023
**Files:** `apps/api/src/routes/proxy.ts`
**Status:** DONE

### Steps
Implement GET `/api/proxy/:sandboxName/*`:
1. Verify user is authenticated
2. Check user has access to sandbox (owner, team, or shared)
3. Get Cloud Run URL from DB
4. Get identity token using `google-auth-library`
5. Fetch target URL with identity token
6. Stream response back to user

### Acceptance Criteria
- [x] Unauthenticated requests return 401
- [x] Unauthorized users (no access) return 403
- [x] Proxies GET requests to correct Cloud Run URL
- [x] Proxies POST/PUT/DELETE requests with body
- [x] Passes through response status code and headers
- [x] Streams response body (not buffered)
- [x] Uses service account identity token for Cloud Run auth
- [x] Handles sandbox not found with 404

---

## W1-023: Auth Middleware — Google OAuth

**Depends on:** W1-001
**Files:** `apps/api/src/middleware/auth.ts`, `apps/api/src/routes/auth.ts`
**Status:** DONE

### Steps
1. POST `/api/auth/login`: redirect to Google OAuth consent screen
2. GET `/api/auth/callback`: exchange code for tokens, set JWT session cookie
3. GET `/api/auth/me`: return current user from cookie
4. POST `/api/auth/logout`: clear session cookie
5. Middleware: extract user from JWT cookie or Bearer header, set `c.set("user", { email, name })`

### Acceptance Criteria
- [x] `/api/auth/login` redirects to Google OAuth URL
- [x] `/api/auth/callback` exchanges code, sets signed JWT cookie
- [x] `/api/auth/me` returns `{ email, name }` for authenticated user
- [x] `/api/auth/me` returns 401 for unauthenticated request
- [x] `/api/auth/logout` clears the session cookie
- [x] Middleware sets `user` on Hono context for all protected routes
- [x] JWT cookie is httpOnly, secure (in production), sameSite strict
- [x] JWT uses `JWT_SECRET` from config for signing
- [x] Bearer token in Authorization header also accepted

---

## W1-024: Error Handler Middleware

**Depends on:** W0-012
**Files:** `apps/api/src/middleware/error-handler.ts`
**Status:** DONE

### Steps
Global error handler: catch all unhandled errors, return structured JSON `{ error: { code, message, details? } }` with appropriate HTTP status.

### Acceptance Criteria
- [x] Zod validation errors return 400 with field-level details
- [x] Not found errors return 404
- [x] Auth errors return 401/403
- [x] Unknown errors return 500 with generic message (no stack in production)
- [x] All error responses follow `{ error: { code, message } }` shape
- [x] Errors are logged to console with full details

---

## Wave 1 — Final Validation

### End-to-End Test (Manual)
```bash
# 1. Create sandbox from ZIP
curl -X POST http://localhost:8080/api/sandboxes \
  -F 'config={"name":"test-app","ttl_days":7}' \
  -F 'source=@test-app.zip' \
  -H 'Cookie: session=...'

# 2. Verify sandbox is running
curl http://localhost:8080/api/sandboxes

# 3. Access via proxy
curl http://localhost:8080/api/proxy/test-app/

# 4. Destroy
curl -X DELETE http://localhost:8080/api/sandboxes/{id}
```

### Wave 1 Complete Criteria
- [x] All 24 tasks (W1-001 through W1-024) pass their acceptance criteria
- [x] Full create-to-live-URL flow completes in < 3 minutes
- [x] Source snapshot visible in GCS bucket
- [x] Container image visible in Artifact Registry
- [x] Cloud Run service running and accessible via proxy
- [x] API runs locally with `pnpm dev`
- [x] API deployable to Cloud Run via Dockerfile
