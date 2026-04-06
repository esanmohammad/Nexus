# Deployment Checklist — Per Wave

Run this checklist after completing each wave, before moving to the next.

---

## DC-001: Build Passes

### Acceptance Criteria
- [ ] `pnpm install` completes with no errors
- [ ] `pnpm build` succeeds across all workspaces (no TypeScript errors)

---

## DC-002: Lint Passes

### Acceptance Criteria
- [ ] `pnpm lint` passes with zero warnings and zero errors
- [ ] No ESLint rule violations

---

## DC-003: Tests Pass

### Acceptance Criteria
- [ ] `pnpm test` passes across all workspaces
- [ ] No skipped tests (unless intentionally marked with reason)
- [ ] No flaky tests (run twice to verify)

---

## DC-004: CI Green

### Acceptance Criteria
- [ ] Push to main triggers GitHub Actions
- [ ] CI workflow passes (install, build, lint, test)
- [ ] No warnings in CI output

---

## DC-005: API Deployed

### Acceptance Criteria
- [ ] API Docker image builds locally: `docker build -f apps/api/Dockerfile -t nexus-api .`
- [ ] API deployed to Cloud Run
- [ ] `GET /api/health` returns 200 on Cloud Run URL
- [ ] API logs visible in Cloud Logging

---

## DC-006: Web Deployed (Wave 3+)

### Acceptance Criteria
- [ ] Web Docker image builds: `docker build -f apps/web/Dockerfile -t nexus-web .`
- [ ] Web deployed to Cloud Run
- [ ] Home page accessible on Cloud Run URL
- [ ] N/A for waves before Wave 3

---

## DC-007: No Regressions

### Acceptance Criteria
- [ ] All acceptance criteria from PREVIOUS waves still pass
- [ ] Run a quick smoke test of each previous wave's core feature:
  - Wave 0: health endpoint responds
  - Wave 1: can create sandbox (if GCP configured)
  - Wave 2: can deploy version + rollback
  - Wave 3: web UI loads, create flow works
  - Wave 4: CLI commands work, MCP tools list
  - Wave 5: Slack bot responds
  - Wave 6: DB creation works
  - Wave 7: webhook triggers deploy
  - Wave 8: admin panel loads

---

## DC-008: Environment Variables Documented

### Acceptance Criteria
- [ ] All new env vars added to `.env.example` with comments
- [ ] No hardcoded secrets in source code
- [ ] No env vars used that aren't in `.env.example`

---

## DC-009: New GCP Resources Documented

### Acceptance Criteria
- [ ] Any new GCP resources (buckets, scheduler jobs, service accounts) documented
- [ ] Creation commands recorded (for reproducibility)
- [ ] N/A if no new GCP resources in this wave

---

## DC-010: Code Quality

### Acceptance Criteria
- [ ] No `any` types (unless explicitly justified)
- [ ] No `console.log` in production code (use structured logger after Wave 8)
- [ ] No commented-out code
- [ ] No TODO comments without linked issue/task ID
- [ ] Import paths use `.js` extension (ESM compatibility)
