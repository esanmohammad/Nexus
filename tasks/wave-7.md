# Wave 7 — GitHub Integration + Promotion

**Goal:** Long-lived sandboxes connect to GitHub repos. Auto-deploy on push. Maturity model for sandbox lifecycle.

**Duration:** Week 13-14
**Depends on:** Wave 2 complete

---

## W7-001: GitHub Service — Create Repo from Snapshot

**Depends on:** W1-005
**Files:** `apps/api/src/services/github.service.ts`

### Steps
Implement `createRepoFromSnapshot(params)`: download source snapshot from GCS, create GitHub repo via API, push source as initial commit.

### Acceptance Criteria
- [x] Creates repo with correct name and description
- [x] Downloads source from GCS snapshot URL
- [x] Pushes source as initial commit to `main` branch
- [x] Returns `{ repoUrl, fullName }` (e.g., `"org/my-app"`)
- [x] Handles GitHub API errors with descriptive messages
- [x] Repo created as private by default

---

## W7-002: GitHub Service — Webhook Management

**Depends on:** W7-001
**Files:** `apps/api/src/services/github.service.ts`

### Steps
1. `createWebhook(repoFullName, sandboxId)`: create push webhook, return `webhookId`
2. `deleteWebhook(repoFullName, webhookId)`: remove webhook

### Acceptance Criteria
- [x] `createWebhook` creates webhook for `push` events on `main` branch
- [x] Webhook URL points to `POST /api/webhooks/github`
- [x] Webhook secret generated and stored for verification
- [x] Returns `webhookId` string
- [x] `deleteWebhook` removes webhook from repo
- [x] `deleteWebhook` is idempotent

---

## W7-003: GitHub Webhook Handler

**Depends on:** W7-002, W2-001
**Files:** `apps/api/src/routes/webhooks.ts`

### Steps
POST `/api/webhooks/github`:
1. Verify `X-Hub-Signature-256` header
2. Parse push event (branch, commit SHA)
3. Find sandbox by `github_repo`
4. Clone repo at pushed commit → tar → deploy as new version
5. Label: `"Auto-deploy from {branch} ({shortSha})"`

### Acceptance Criteria
- [x] Verifies GitHub webhook signature (rejects invalid)
- [x] Only processes push events to `main` branch
- [x] Ignores pushes to other branches
- [x] Finds sandbox by matching `github_repo` field
- [x] Returns 404 if no matching sandbox
- [x] Clones repo at the specific commit SHA
- [x] Tars cloned source (excluding `.git/`)
- [x] Deploys as new version via version service
- [x] Version label: `"Auto-deploy from main (abc1234)"` (7-char SHA)
- [x] Returns 200 with deploy status

---

## W7-004: Connect Repo Endpoint

**Depends on:** W7-002
**Files:** `apps/api/src/routes/sandboxes.ts`, `apps/api/src/services/sandbox.service.ts`

### Steps
POST `/api/sandboxes/:id/connect-repo`:
1. Accept `{ repo: "org/repo-name" }`
2. Verify repo exists and user has access
3. Create webhook on repo
4. Store `github_repo` and `github_webhook_id` on sandbox

### Acceptance Criteria
- [x] Accepts `repo` field with `org/repo` format
- [x] Verifies repo exists via GitHub API
- [x] Creates webhook on the repo
- [x] Stores `github_repo` and `github_webhook_id` on sandbox row
- [x] Returns 400 if repo doesn't exist or user lacks access
- [x] Returns 409 if sandbox already connected to a repo

---

## W7-005: Disconnect Repo Endpoint

**Depends on:** W7-002
**Files:** `apps/api/src/routes/sandboxes.ts`, `apps/api/src/services/sandbox.service.ts`

### Steps
DELETE `/api/sandboxes/:id/connect-repo`:
1. Remove webhook from GitHub
2. Clear `github_repo` and `github_webhook_id` from sandbox

### Acceptance Criteria
- [x] Removes webhook from GitHub repo
- [x] Clears `github_repo` and `github_webhook_id` fields
- [x] Returns 200 on success
- [x] Handles already-disconnected gracefully (idempotent)

---

## W7-006: Maturity Computation

**Depends on:** W0-008
**Files:** `apps/api/src/services/sandbox.service.ts`

### Steps
Implement `computeMaturity(sandbox)`:
- `github_repo` set AND age > 90 days → `"graduated"`
- Age > 30 days → `"established"`
- Age > 7 days → `"incubating"`
- Default → `"throwaway"`

### Acceptance Criteria
- [x] Sandbox < 7 days old → `"throwaway"`
- [x] Sandbox 7-30 days old → `"incubating"`
- [x] Sandbox > 30 days old without repo → `"established"`
- [x] Sandbox > 90 days old with repo → `"graduated"`
- [x] `"graduated"` sandboxes have TTL effectively infinite
- [x] Function is pure (no side effects, computes from data)

---

## W7-007: Promote Endpoint

**Depends on:** W7-001, W7-006
**Files:** `apps/api/src/routes/sandboxes.ts`

### Steps
POST `/api/sandboxes/:id/promote`:
1. Extend TTL (30d for incubating→established, 90d for established→graduated)
2. If no GitHub repo: create one from latest version's source snapshot
3. Update maturity level

### Acceptance Criteria
- [x] Extends TTL based on promotion target
- [x] Creates GitHub repo if sandbox has no repo
- [x] Repo created with sandbox name and description
- [x] Returns updated sandbox with new maturity
- [x] Cannot promote already-graduated sandbox (400)

---

## W7-008: Update UI — Maturity Badge

**Depends on:** W7-006, W3-007
**Files:** `apps/web/src/components/status-badge.tsx`, `apps/web/src/app/sandboxes/[id]/page.tsx`

### Steps
Add maturity badge to sandbox detail page. Colors: gray=throwaway, blue=incubating, purple=established, gold=graduated.

### Acceptance Criteria
- [x] Maturity badge shown on sandbox detail page
- [x] Correct color per maturity level
- [x] Badge text matches maturity name

---

## W7-009: Update UI — Connect GitHub Section

**Depends on:** W7-004, W7-005
**Files:** `apps/web/src/app/sandboxes/[id]/settings/page.tsx`

### Steps
Add "GitHub" section to sandbox settings: repo picker (text input for now), connect/disconnect buttons.

### Acceptance Criteria
- [x] Shows "Connected to org/repo" if connected, with disconnect button
- [x] Shows "Connect GitHub repo" input + button if not connected
- [x] Connect calls POST `/api/sandboxes/:id/connect-repo`
- [x] Disconnect calls DELETE `/api/sandboxes/:id/connect-repo`
- [x] Shows error if repo not found

---

## W7-010: Update UI — Promote Button

**Depends on:** W7-007
**Files:** `apps/web/src/app/sandboxes/[id]/page.tsx`

### Steps
Show "Promote" button for eligible sandboxes. Show banner for sandboxes > 30 days without a repo.

### Acceptance Criteria
- [x] "Promote" button visible for `"incubating"` and `"established"` sandboxes
- [x] Button text: "Promote to Established" or "Promote to Graduated"
- [x] Clicking calls promote API
- [x] Banner: "This sandbox has been around for 30+ days. Consider promoting it."
- [x] Banner only for sandboxes > 30 days without repo
- [x] Button hidden for `"graduated"` and `"throwaway"` sandboxes

---

## W7-011: Integration Test — Auto-Deploy

**Depends on:** W7-003
**Files:** `apps/api/test/github.test.ts`

### Steps
Test webhook handler: send mock push event → verify new version created with correct label.

### Acceptance Criteria
- [x] Valid webhook payload triggers version deploy
- [x] Invalid signature returns 401
- [x] Push to non-main branch is ignored
- [x] Version label matches "Auto-deploy from main ({sha})" pattern
- [x] Test passes with `pnpm --filter @nexus/api test`

---

## W7-012: Integration Test — Maturity

**Depends on:** W7-006
**Files:** `apps/api/test/maturity.test.ts`

### Steps
Test maturity computation for all 4 levels with various age/repo combinations.

### Acceptance Criteria
- [x] 1-day-old sandbox → `"throwaway"`
- [x] 10-day-old sandbox → `"incubating"`
- [x] 45-day-old sandbox without repo → `"established"`
- [x] 100-day-old sandbox with repo → `"graduated"`
- [x] 100-day-old sandbox without repo → `"established"` (not graduated)
- [x] Test passes

---

## Wave 7 — Final Validation

### End-to-End Test
```bash
# 1. Create sandbox, connect to GitHub repo
# 2. Push commit to repo → verify auto-deploy creates new version
# 3. Verify version label: "Auto-deploy from main (abc1234)"
# 4. Promote sandbox → verify repo created if none existed
# 5. Verify maturity badge on UI
# 6. Disconnect repo → verify webhook removed
```

### Wave 7 Complete Criteria
- [x] All 12 tasks pass acceptance criteria
- [x] Connect GitHub repo creates webhook
- [x] Push to main triggers auto-deploy
- [x] Auto-deploy versions labeled correctly
- [x] Promote creates repo if needed, extends TTL
- [x] Maturity badge shows on detail page
- [x] Soft prompt for 30+ day sandboxes without repo
- [x] Graduated sandboxes are permanent (no TTL expiry)
- [x] Disconnect removes webhook

---
**Status: DONE**
