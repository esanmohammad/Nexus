# Wave 8 — Admin Panel + Observability + Polish

**Goal:** Platform admins have full visibility. Build error UX improved. Production hardening.

**Duration:** Week 15-16
**Depends on:** Wave 3 complete

---

## W8-001: Audit Log Middleware

**Depends on:** W0-011, W1-024
**Files:** `apps/api/src/middleware/audit-log.ts`

### Steps
Middleware that logs every mutating API call (POST, PATCH, DELETE) to `audit_logs` table. Captures: actor_email, action (e.g., `sandbox.create`), resource_type, resource_id, sanitized request details, IP address, user agent.

### Acceptance Criteria
- [x] Logs on all POST, PATCH, DELETE requests
- [x] Does NOT log on GET requests
- [x] `actor_email` extracted from auth context
- [x] `action` derived from method + route (e.g., `"sandbox.create"`, `"version.deploy"`)
- [x] `resource_type` and `resource_id` extracted from route params
- [x] Request body sanitized (no passwords, tokens, file contents)
- [x] IP address captured from `X-Forwarded-For` or remote address
- [x] User agent captured from `User-Agent` header
- [x] Middleware errors don't block the API response

---

## W8-002: Admin — Auth Guard

**Depends on:** W1-023
**Files:** `apps/api/src/middleware/admin.ts`

### Steps
Create admin middleware: check if authenticated user's email is in admin allowlist (env var `ADMIN_EMAILS`, comma-separated).

### Acceptance Criteria
- [x] `ADMIN_EMAILS` env var added to config schema
- [x] Middleware returns 403 for non-admin users
- [x] Middleware passes for admin users
- [x] Works with existing auth middleware chain

---

## W8-003: Admin API — Global Stats

**Depends on:** W8-002
**Files:** `apps/api/src/routes/admin.ts`

### Steps
GET `/api/admin/stats`: return global statistics — total sandboxes by state, total versions, builds today, active users.

### Acceptance Criteria
- [x] Returns `{ sandboxes_by_state: { running: N, sleeping: N, ... }, total_versions: N, builds_today: N, active_users: N }`
- [x] Only accessible to admins (403 for non-admins)
- [x] Counts are accurate (query DB)

---

## W8-004: Admin API — All Sandboxes List

**Depends on:** W8-002
**Files:** `apps/api/src/routes/admin.ts`

### Steps
GET `/api/admin/sandboxes`: list ALL sandboxes (all users). Query params: `owner`, `team`, `state`, `sort`, `page`, `limit`.

### Acceptance Criteria
- [x] Returns all sandboxes regardless of owner
- [x] `?owner=email@co.com` filters by owner
- [x] `?team=marketing` filters by team
- [x] `?state=running` filters by state
- [x] Pagination via `page` and `limit` (default 20)
- [x] `?sort=created_at` or `sort=expires_at` supported
- [x] Only accessible to admins

---

## W8-005: Admin API — Force Destroy

**Depends on:** W8-002, W1-020
**Files:** `apps/api/src/routes/admin.ts`

### Steps
DELETE `/api/admin/sandboxes/:id`: admin can force-destroy any sandbox. Logs as admin action in audit log.

### Acceptance Criteria
- [x] Destroys sandbox regardless of ownership
- [x] Audit log records admin email as actor
- [x] Audit log action: `"admin.force_destroy"`
- [x] Returns 200 with destroyed sandbox info
- [x] Only accessible to admins

---

## W8-006: Admin API — Audit Log Viewer

**Depends on:** W8-001, W8-002
**Files:** `apps/api/src/routes/admin.ts`

### Steps
GET `/api/admin/audit-logs`: paginated, searchable audit log. Query params: `actor`, `action`, `resource_type`, `resource_id`, `from`, `to`, `page`, `limit`.

### Acceptance Criteria
- [x] Returns paginated audit log entries
- [x] `?actor=email@co.com` filters by actor
- [x] `?action=sandbox.create` filters by action
- [x] `?resource_id={id}` filters by resource
- [x] `?from=2026-01-01&to=2026-02-01` date range filter
- [x] Default sorted by `created_at` descending
- [x] Only accessible to admins

---

## W8-007: Admin Web — Dashboard Page

**Depends on:** W8-003, W8-004
**Files:** `apps/web/src/app/admin/page.tsx`

### Steps
Admin dashboard: stat cards (total sandboxes by state, builds today), sandbox table (all sandboxes, filterable), force destroy button.

### Acceptance Criteria
- [x] Route `/admin` only accessible to admin users
- [x] Non-admins redirected to home or shown 403
- [x] Stat cards show live counts
- [x] Sandbox table shows all sandboxes with owner, state, version, expires
- [x] Filter controls for owner, team, state
- [x] "Force Destroy" button with confirmation
- [x] Page auto-refreshes stats (TanStack Query polling)

---

## W8-008: Admin Web — Audit Log Page

**Depends on:** W8-006
**Files:** `apps/web/src/app/admin/audit-logs/page.tsx`

### Steps
Audit log viewer: searchable table with filters for actor, action, resource, date range.

### Acceptance Criteria
- [x] Table columns: Time, Actor, Action, Resource, Details
- [x] Search box filters across all columns
- [x] Date range picker
- [x] Action filter dropdown
- [x] Pagination controls
- [x] Click row to expand details JSON

---

## W8-009: Build Error Parser — Core

**Depends on:** W1-013
**Files:** `apps/api/src/lib/build-error-parser.ts`

### Steps
Implement `parseBuildError(log)`: scan build log for known error patterns, return `{ summary, category, suggestion, autoFixable }`.

### Acceptance Criteria
- [x] Detects `npm ERR! missing script: start` → category: `"missing_start_script"`, suggestion: "Add start script"
- [x] Detects `ENOENT: no such file or directory` → category: `"file_not_found"`
- [x] Detects `ModuleNotFoundError` (Node) → category: `"missing_dependency"`
- [x] Detects port mismatch (EXPOSE vs app port) → category: `"port_mismatch"`
- [x] Detects Python `ModuleNotFoundError` → category: `"missing_python_package"`
- [x] Returns `autoFixable: true` for patterns that can be auto-patched
- [x] Returns generic summary for unknown errors
- [x] Unit test for each pattern (5 tests minimum)

---

## W8-010: Build Error Parser — Integration

**Depends on:** W8-009, W2-001
**Files:** `apps/api/src/services/version.service.ts`

### Steps
After build failure, call `parseBuildError(log)` and store parsed result on version row (new `build_error` jsonb column or in metadata).

### Acceptance Criteria
- [x] Build failure triggers error parsing
- [x] Parsed error stored on version (accessible via API)
- [x] GET version endpoint includes `build_error` field when status is `"failed"`

---

## W8-011: Build Log Streaming — SSE Endpoint

**Depends on:** W1-013
**Files:** `apps/api/src/routes/versions.ts`

### Steps
GET `/api/sandboxes/:id/versions/:num/logs/stream`: Server-Sent Events endpoint. Sends `log`, `status`, and `done` events.

### Acceptance Criteria
- [x] Response Content-Type: `text/event-stream`
- [x] `event: log` with `data: {"line": "...", "timestamp": "..."}`
- [x] `event: status` with `data: {"status": "building" | "live" | "failed"}`
- [x] `event: done` when build completes
- [x] Connection closes after `done` event
- [x] Handles client disconnect gracefully
- [x] Falls back to polling if SSE not supported

---

## W8-012: Update Web — Build Log to SSE

**Depends on:** W8-011, W3-012
**Files:** `apps/web/src/components/build-log-stream.tsx`

### Steps
Update build log component to use SSE instead of polling when available.

### Acceptance Criteria
- [x] Uses `EventSource` to connect to SSE endpoint
- [x] Falls back to polling if SSE connection fails
- [x] Log lines appear in real-time (no 2s delay)
- [x] Status events trigger UI updates
- [x] `done` event stops connection and shows final status

---

## W8-013: Error Recovery UX

**Depends on:** W8-009, W8-010
**Files:** `apps/web/src/components/build-error-display.tsx`

### Steps
Component shown on build failure: "What happened" (summary), "How to fix" (suggestion), "Try again with fix applied" button (if autoFixable), "Upload fixed" button, "View full build log" link.

### Acceptance Criteria
- [x] Shows human-readable error summary
- [x] Shows specific fix suggestion
- [x] "Try again with fix applied" button visible only when `autoFixable: true`
- [x] "Upload fixed" button opens deploy dropzone
- [x] "View full build log" expands full log
- [x] Styled clearly as error state (red/warning colors)

---

## W8-014: Web UI Dockerfile

**Depends on:** W0-013
**Files:** `apps/web/Dockerfile`

### Steps
Multi-stage Dockerfile for Next.js: install deps → build → standalone output → runtime image.

### Acceptance Criteria
- [x] Multi-stage build (base, deps, build, runtime)
- [x] Uses `next build` with `output: "standalone"` config
- [x] Final image includes only standalone output + public + static
- [x] `EXPOSE 3000`
- [x] `docker build -t nexus-web .` succeeds
- [x] Container starts and serves pages

---

## W8-015: Rate Limiting

**Depends on:** W0-012
**Files:** `apps/api/src/middleware/rate-limit.ts`, `apps/api/src/index.ts`

### Steps
Add rate limiting middleware: 100 requests/minute per IP for general routes, 10 requests/minute for mutating routes.

### Acceptance Criteria
- [x] GET routes: 100 req/min per IP
- [x] POST/PATCH/DELETE routes: 10 req/min per IP
- [x] Returns 429 with `Retry-After` header when exceeded
- [x] Rate limit headers included: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- [x] Internal routes (cleanup) exempt from rate limiting

---

## W8-016: Security Headers

**Depends on:** W0-012
**Files:** `apps/api/src/index.ts`

### Steps
Add security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `X-XSS-Protection`, request size limit (100 MB).

### Acceptance Criteria
- [x] `X-Content-Type-Options: nosniff` present on all responses
- [x] `X-Frame-Options: DENY` present
- [x] `Strict-Transport-Security` present in production
- [x] Request body size limited to 100 MB
- [x] Requests > 100 MB return 413

---

## W8-017: Structured Logging

**Depends on:** W0-012
**Files:** `apps/api/src/lib/logger.ts`, `apps/api/src/index.ts`

### Steps
Replace `console.log` with structured JSON logging for Cloud Logging compatibility. Include: timestamp, level, message, request_id, user_email.

### Acceptance Criteria
- [x] Log format: JSON with `timestamp`, `severity`, `message` fields
- [x] Request ID generated per request and included in logs
- [x] User email included when available
- [x] Cloud Logging compatible (`severity` field: INFO, WARNING, ERROR)
- [x] All existing console.log calls replaced

---

## W8-018: Graceful Shutdown

**Depends on:** W0-012
**Files:** `apps/api/src/index.ts`

### Steps
Handle SIGTERM/SIGINT: stop accepting new requests, wait for in-flight requests to complete (up to 30s timeout), then exit.

### Acceptance Criteria
- [x] SIGTERM triggers graceful shutdown
- [x] In-flight requests complete before exit
- [x] New requests rejected during shutdown
- [x] Forced exit after 30 second timeout
- [x] Health endpoint returns 503 during shutdown
- [x] Log message: "Shutting down gracefully..."

---

## Wave 8 — Final Validation

### Wave 8 Complete Criteria
- [x] All 18 tasks pass acceptance criteria
- [x] Admin panel shows global stats
- [x] Admin can view/destroy any sandbox
- [x] Audit log captures all mutating actions
- [x] Audit log searchable with filters
- [x] Build failures show human-readable errors with fix suggestions
- [x] "Try again with fix applied" auto-patches simple errors
- [x] Build logs stream via SSE (real-time)
- [x] Rate limiting active
- [x] Security headers present
- [x] Structured JSON logging
- [x] Both API and Web Dockerfiles build and run
- [x] Graceful shutdown works

---
**Status: DONE**
