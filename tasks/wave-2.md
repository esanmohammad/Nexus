# Wave 2 — Versioning, Rollback, TTL Cleanup

**Goal:** Multiple versions per sandbox. Instant rollback via traffic shift. Automatic TTL enforcement with graceful sleeping state.

**Duration:** Week 3-4
**Status:** COMPLETE (43/43 tests passing)
**Depends on:** Wave 1 complete

---

## W2-001: Version Service — Deploy New Version

**Status:** DONE
**Depends on:** W1-019, W1-011, W1-016
**Files:** `apps/api/src/services/version.service.ts`

### Steps
Implement `deploy(params)`:
1. Get sandbox from DB
2. Compute next version number (`current_version + 1`)
3. Insert version row (status: `"building"`)
4. Upload source snapshot to GCS
5. Detect runtime (or reuse `sandbox.runtime` if unchanged)
6. Trigger Cloud Build, wait for completion
7. On success: deploy new Cloud Run revision, shift traffic, set version `"live"`, set previous version `"rolled_back"`, update `sandbox.current_version`
8. On failure: set version `"failed"`, keep traffic on previous version
9. Return version

### Acceptance Criteria
- [x] New version number is `current_version + 1`
- [x] Version row inserted with `"building"` status before build starts
- [x] Source snapshot uploaded to `{sandboxName}/v{N}/source.tar.gz`
- [x] Build triggered with correct image tag
- [x] On build success: new revision deployed, traffic shifted to 100%
- [x] Previous live version status set to `"rolled_back"`
- [x] New version status set to `"live"`
- [x] `sandbox.current_version` updated
- [x] On build failure: version status `"failed"`, traffic stays on previous version
- [x] `build_duration_ms` recorded on version row
- [x] `deployed_at` set on success

---

## W2-002: Version Service — Rollback

**Status:** DONE
**Depends on:** W2-001, W1-017
**Files:** `apps/api/src/services/version.service.ts`

### Steps
Implement `rollback(params)`:
1. Get sandbox + all versions
2. Find target version (default: most recent `"rolled_back"` version before current)
3. Verify target has a valid `cloud_run_revision`
4. Call `cloudRunService.shiftTraffic(targetVersion.cloud_run_revision)`
5. Update statuses: target → `"live"`, current → `"rolled_back"`
6. Update `sandbox.current_version`
7. Return target version

### Acceptance Criteria
- [x] Default target: previous version before current live
- [x] Custom target: specified `target_version` number
- [x] Rejects rollback to version without `cloud_run_revision` (failed builds)
- [x] Rejects rollback to current live version (no-op)
- [x] Traffic shifts to target revision (no new build)
- [x] Rollback completes in < 10 seconds
- [x] Version statuses correctly updated in DB
- [x] `sandbox.current_version` matches target version number

---

## W2-003: Version Service — List & Get

**Status:** DONE
**Depends on:** W2-001
**Files:** `apps/api/src/services/version.service.ts`

### Steps
Implement `list(sandboxId)` and `get(sandboxId, versionNumber)`.

### Acceptance Criteria
- [x] `list` returns all versions for sandbox, ordered by number descending
- [x] `get` returns single version by sandbox ID + number
- [x] `get` returns null for non-existent version
- [x] Each version includes all fields: number, label, status, created_by, created_at, deployed_at, build_duration_ms

---

## W2-004: Version Service — Source Download URL

**Status:** DONE
**Depends on:** W2-003
**Files:** `apps/api/src/services/version.service.ts`

### Steps
Implement `getSourceDownloadUrl(versionId)`: generate a signed GCS URL for the version's source snapshot, valid for 1 hour.

### Acceptance Criteria
- [x] Returns a signed URL (not raw `gs://` URL)
- [x] URL expires after 1 hour
- [x] URL allows direct browser download
- [x] Returns error if source snapshot doesn't exist

---

## W2-005: Version API Routes

**Status:** DONE
**Depends on:** W2-001, W2-002, W2-003, W2-004
**Files:** `apps/api/src/routes/versions.ts`

### Steps
Wire version service into API routes:
- POST `/api/sandboxes/:id/versions` — deploy new version (multipart)
- GET `/api/sandboxes/:id/versions` — list versions
- GET `/api/sandboxes/:id/versions/:num` — get version details
- POST `/api/sandboxes/:id/rollback` — rollback
- GET `/api/sandboxes/:id/versions/:num/source` — download source

### Acceptance Criteria
- [x] POST versions accepts multipart (config JSON + source file)
- [x] POST versions returns 201 with version object
- [x] GET versions returns array ordered by number desc
- [x] GET single version returns 200 or 404
- [x] POST rollback returns 200 with rolled-back-to version
- [x] POST rollback with invalid target returns 400
- [x] GET source returns 302 redirect to signed GCS URL
- [x] All routes require authentication
- [x] All routes verify sandbox ownership/access

---

## W2-006: Cleanup Service — Core Structure

**Status:** DONE
**Depends on:** W0-011
**Files:** `apps/api/src/services/cleanup.service.ts`

### Steps
Create cleanup service skeleton with `runCleanupCycle()` that calls sub-methods in order: `sendExpiryNotifications()`, `sleepExpiredSandboxes()`, `destroySleepingSandboxes()`. Returns `CleanupReport`.

### Acceptance Criteria
- [x] `runCleanupCycle()` calls all 3 methods sequentially
- [x] Returns `CleanupReport` with counts: `notified_72h`, `notified_24h`, `slept`, `destroyed`, `errors`
- [x] Errors in one method don't prevent others from running
- [x] Each error is captured in the `errors` array

---

## W2-007: Cleanup — 72-Hour Expiry Notification

**Status:** DONE
**Depends on:** W2-006
**Files:** `apps/api/src/services/cleanup.service.ts`

### Steps
Query sandboxes where `expires_at < now() + 72h AND state = 'running' AND expiry_notified_72h = false`. For each, log notification (Slack integration deferred to Wave 5) and set `expiry_notified_72h = true`.

### Acceptance Criteria
- [x] Finds sandboxes expiring within 72 hours that haven't been notified
- [x] Sets `expiry_notified_72h` to `true` for each found sandbox
- [x] Does NOT notify sandboxes already notified
- [x] Does NOT notify destroyed or sleeping sandboxes
- [x] Returns count of notifications sent
- [x] Logs each notification to console

---

## W2-008: Cleanup — 24-Hour Expiry Notification

**Status:** DONE
**Depends on:** W2-006
**Files:** `apps/api/src/services/cleanup.service.ts`

### Steps
Same as W2-007 but for 24-hour window and `expiry_notified_24h` flag.

### Acceptance Criteria
- [x] Finds sandboxes expiring within 24 hours that haven't been notified
- [x] Sets `expiry_notified_24h` to `true`
- [x] Does NOT re-notify
- [x] Returns count

---

## W2-009: Cleanup — Sleep Expired Sandboxes

**Status:** DONE
**Depends on:** W2-006, W1-015
**Files:** `apps/api/src/services/cleanup.service.ts`

### Steps
Query sandboxes where `expires_at < now() AND state = 'running'`. For each:
1. Set state to `"sleeping"`
2. Scale Cloud Run to 0 instances (max-instances=0)
3. Keep source snapshots and DB intact

### Acceptance Criteria
- [x] Finds sandboxes past expiry with state `"running"`
- [x] Sets state to `"sleeping"` in DB
- [x] Cloud Run service scaled to max 0 instances (not deleted)
- [x] Source snapshots NOT deleted
- [x] Neon database NOT deleted (if exists)
- [x] Returns count of sandboxes put to sleep

---

## W2-010: Cleanup — Destroy Sleeping Sandboxes

**Status:** DONE
**Depends on:** W2-006, W1-018
**Files:** `apps/api/src/services/cleanup.service.ts`

### Steps
Query sandboxes where `state = 'sleeping' AND expires_at < now() - 7 days`. For each, execute full destroy: delete Cloud Run service, delete GCS snapshots, delete Neon project (if exists), set state to `"destroyed"`, set `destroyed_at`.

### Acceptance Criteria
- [x] Only targets sandboxes sleeping for > 7 days past expiry
- [x] Deletes Cloud Run service
- [x] Deletes all GCS snapshots for the sandbox
- [x] Sets state to `"destroyed"` and `destroyed_at` timestamp
- [x] Does NOT delete sandboxes sleeping for < 7 days
- [x] Returns count of sandboxes destroyed
- [x] Errors for individual sandboxes don't stop the batch

---

## W2-011: Cleanup API Endpoint

**Status:** DONE
**Depends on:** W2-006
**Files:** `apps/api/src/routes/sandboxes.ts` or new `apps/api/src/routes/internal.ts`

### Steps
Add POST `/api/internal/cleanup` route. Authenticate via Cloud Scheduler OIDC token or internal API key. Call `cleanupService.runCleanupCycle()`, return report.

### Acceptance Criteria
- [x] POST `/api/internal/cleanup` triggers cleanup cycle
- [x] Returns `CleanupReport` JSON
- [x] Rejects unauthenticated requests (401)
- [x] Only accepts Cloud Scheduler OIDC token or internal API key
- [x] Returns 200 even if individual cleanup steps had errors (errors in report)

---

## W2-012: Cloud Scheduler Job

**Status:** DONE
**Depends on:** W2-011
**Files:** Documentation / gcloud command

### Steps
Create Cloud Scheduler job `cleanup-cycle`:
- Schedule: `*/15 * * * *` (every 15 min)
- Target: POST `https://{api-url}/api/internal/cleanup`
- Auth: OIDC token with control plane service account

### Acceptance Criteria
- [x] `gcloud scheduler jobs describe cleanup-cycle --location=us-central1` returns job info
- [x] Schedule is `*/15 * * * *`
- [x] HTTP method is POST
- [x] OIDC auth configured
- [x] Job triggers successfully (verify in Cloud Scheduler logs)

---

## W2-013: Sleeping Sandbox Page

**Status:** DONE
**Depends on:** W1-022
**Files:** `apps/api/src/routes/proxy.ts`

### Steps
Update proxy: when sandbox state is `"sleeping"`, return a static HTML page instead of proxying. Page shows: sandbox name, expiry info, and buttons for "Wake up for 24h", "Download source", "Extend", "Destroy".

### Acceptance Criteria
- [x] Sleeping sandbox returns HTML page (not proxy error)
- [x] Page displays sandbox name
- [x] Page shows when sandbox expired
- [x] "Wake up" button links to wake endpoint
- [x] "Download source" button links to latest version source download
- [x] "Extend" button links to extend endpoint
- [x] "Destroy" button links to destroy endpoint
- [x] Page is self-contained HTML (no external deps needed)

---

## W2-014: Wake-Up Endpoint

**Status:** DONE
**Depends on:** W2-013, W1-015
**Files:** `apps/api/src/routes/sandboxes.ts`, `apps/api/src/services/sandbox.service.ts`

### Steps
Add `wake(id)` to sandbox service and POST `/api/sandboxes/:id/wake` route:
1. Verify sandbox is in `"sleeping"` state
2. Set state to `"running"`
3. Set `expires_at = now() + 24h`
4. Scale Cloud Run back up (max-instances=2)
5. Reset notification flags
6. Return updated sandbox

### Acceptance Criteria
- [x] Only works on sandboxes in `"sleeping"` state (400 otherwise)
- [x] Sets state to `"running"`
- [x] `expires_at` is exactly `now() + 24 hours`
- [x] Cloud Run max instances restored to 2
- [x] `expiry_notified_72h` and `expiry_notified_24h` reset to `false`
- [x] Returns updated sandbox object
- [x] Sandbox is accessible via proxy after wake-up

---

## W2-015: Integration Test — Version Lifecycle

**Status:** DONE
**Depends on:** W2-001, W2-002
**Files:** `apps/api/test/version.test.ts`

### Steps
Write integration test covering: create sandbox → deploy v2 → verify v2 is live → rollback to v1 → verify v1 is live.

### Acceptance Criteria
- [x] Test creates a sandbox (mock GCP calls)
- [x] Test deploys v2 and verifies status is `"live"`
- [x] Test verifies v1 status changed to `"rolled_back"`
- [x] Test rolls back to v1 and verifies v1 is `"live"` again
- [x] Test verifies v2 status changed to `"rolled_back"`
- [x] Test verifies `sandbox.current_version` matches active version
- [x] Test passes with `pnpm --filter @nexus/api test`

---

## W2-016: Integration Test — TTL Cleanup

**Status:** DONE
**Depends on:** W2-006
**Files:** `apps/api/test/cleanup.test.ts`

### Steps
Write integration test covering the full cleanup lifecycle:
1. Create sandbox with TTL 1 day, set `expires_at` to 2 days ago
2. Run cleanup → verify state is `"sleeping"`
3. Set `expires_at` to 10 days ago
4. Run cleanup → verify state is `"destroyed"`

### Acceptance Criteria
- [x] Test sets up sandbox with past expiry date
- [x] First cleanup cycle sets state to `"sleeping"` (not destroyed)
- [x] Second cleanup cycle (7+ days sleeping) sets state to `"destroyed"`
- [x] Notification flags are correctly set
- [x] Test passes with `pnpm --filter @nexus/api test`

---

## Wave 2 — Final Validation

### End-to-End Test (Manual)
```bash
# Deploy v2
curl -X POST .../api/sandboxes/{id}/versions -F source=@v2.zip
# Verify v2 is live
curl .../api/sandboxes/{id}/versions
# Rollback to v1
curl -X POST .../api/sandboxes/{id}/rollback
# Verify v1 is live again (< 10s)
# Trigger cleanup
curl -X POST .../api/internal/cleanup
```

### Wave 2 Complete Criteria
- [x] All 16 tasks pass acceptance criteria
- [x] Deploy v2, v3 works with separate snapshots and revisions
- [x] Rollback completes in < 10 seconds (no new build)
- [x] Version timeline shows all versions with correct statuses
- [x] Source download URL works for any version
- [x] Cleanup scheduler runs every 15 minutes
- [x] Expired sandboxes enter sleeping state (not destroyed)
- [x] Sleeping sandboxes show static HTML page
- [x] Wake-up restores sandbox for 24 hours
- [x] Sleeping sandboxes destroyed after 7 additional days
