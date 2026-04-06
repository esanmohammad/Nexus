# Wave 3 — Web UI (Dashboard + Deploy + Versions)

**Goal:** Non-technical users can create sandboxes, deploy versions, and roll back via a browser.

**Duration:** Week 5-6
**Depends on:** Wave 2 complete
**Status:** DONE

---

## W3-001: SDK Package — Client Class

**Depends on:** W1-021
**Files:** `packages/sdk/package.json`, `packages/sdk/tsconfig.json`, `packages/sdk/src/client.ts`, `packages/sdk/src/index.ts`

### Steps
Create `NexusClient` class with constructor `(baseUrl, token?)`. All methods call the API and return typed responses. Handle errors consistently.

### Acceptance Criteria
- [x] `packages/sdk/package.json` exists with name `@nexus/sdk`
- [x] `NexusClient` constructor accepts `baseUrl` and optional `token`
- [x] Token sent as `Authorization: Bearer {token}` header
- [x] TypeScript compiles, `pnpm --filter @nexus/sdk build` succeeds

---

## W3-002: SDK — Sandbox Methods

**Depends on:** W3-001
**Files:** `packages/sdk/src/sandboxes.ts`

### Steps
Implement on NexusClient: `createSandbox(config, source)`, `listSandboxes()`, `getSandbox(id)`, `updateSandbox(id, input)`, `destroySandbox(id)`, `extendSandbox(id, ttlDays)`, `shareSandbox(id, input)`.

### Acceptance Criteria
- [x] `createSandbox` sends multipart form with config JSON + File
- [x] `listSandboxes` returns `Sandbox[]`
- [x] `getSandbox` returns single `Sandbox`
- [x] `updateSandbox` sends PATCH, returns updated `Sandbox`
- [x] `destroySandbox` sends DELETE, returns void
- [x] `extendSandbox` sends POST to extend endpoint
- [x] `shareSandbox` sends POST to share endpoint
- [x] All methods throw typed errors on failure

---

## W3-003: SDK — Version Methods

**Depends on:** W3-001
**Files:** `packages/sdk/src/versions.ts`

### Steps
Implement: `deployVersion(sandboxId, source, label?)`, `listVersions(sandboxId)`, `rollback(sandboxId, targetVersion?)`, `getBuildLog(sandboxId, versionNumber)`, `getSourceDownloadUrl(sandboxId, versionNumber)`.

### Acceptance Criteria
- [x] `deployVersion` sends multipart form, returns `Version`
- [x] `listVersions` returns `Version[]`
- [x] `rollback` sends POST, returns `Version`
- [x] `getBuildLog` returns string
- [x] `getSourceDownloadUrl` returns URL string

---

## W3-004: Web — Auth Setup

**Depends on:** W0-013, W1-023
**Files:** `apps/web/src/lib/auth.ts`

### Steps
Create auth utilities: `getSession()` (read session cookie), `login()` (redirect to API OAuth), `logout()`, `useAuth()` React hook.

### Acceptance Criteria
- [x] `login()` redirects browser to `/api/auth/login`
- [x] `logout()` calls `/api/auth/logout` and clears local state
- [x] `useAuth()` hook returns `{ user, isLoading, isAuthenticated }`
- [x] Unauthenticated users redirected to login page

---

## W3-005: Web — API Client Setup

**Depends on:** W3-001, W3-004
**Files:** `apps/web/src/lib/api-client.ts`

### Steps
Initialize `NexusClient` with API base URL and session token. Set up TanStack Query `QueryClient` with default options.

### Acceptance Criteria
- [x] `NexusClient` instance created with correct base URL
- [x] Session token automatically included from auth context
- [x] `QueryClient` configured with sensible defaults (staleTime, retry)
- [x] `QueryClientProvider` wrapped in root layout

---

## W3-006: Web — Root Layout

**Depends on:** W3-004, W3-005
**Files:** `apps/web/src/app/layout.tsx`

### Steps
Root layout with: HTML head (title "Nexus"), QueryClientProvider, header (logo, user avatar/login button), main content area.

### Acceptance Criteria
- [x] Page title is "Nexus"
- [x] Header shows "Nexus" logo/text
- [x] Header shows user avatar + email when authenticated
- [x] Header shows "Login" button when unauthenticated
- [x] Children rendered in main content area
- [x] Tailwind CSS loaded and functional

---

## W3-007: Web — Status Badge Component

**Depends on:** W0-013
**Files:** `apps/web/src/components/status-badge.tsx`

### Steps
Colored badge component: green=running, yellow=sleeping, gray=creating, red=failed/destroyed.

### Acceptance Criteria
- [x] Accepts `status` prop matching `SandboxState` or `VersionStatus`
- [x] Green badge for `"running"` / `"live"`
- [x] Yellow badge for `"sleeping"` / `"building"`
- [x] Gray badge for `"creating"` / `"rolled_back"`
- [x] Red badge for `"failed"` / `"destroyed"` / `"destroying"`
- [x] Displays status text inside badge

---

## W3-008: Web — Sandbox Card Component

**Depends on:** W3-007
**Files:** `apps/web/src/components/sandbox-card.tsx`

### Steps
Card component showing: status badge, sandbox name, current version + deployer + time, URL, expiry countdown, "Open" and "Deploy" buttons.

### Acceptance Criteria
- [x] Shows status badge (color-coded)
- [x] Shows sandbox name prominently
- [x] Shows current version number, deployer email, relative time ("2h ago")
- [x] Shows `cloud_run_url` (truncated if long)
- [x] Shows "Expires in X days" countdown
- [x] "Open" button links to sandbox URL (new tab)
- [x] "Deploy" button links to `/sandboxes/{id}/deploy`
- [x] Clicking card navigates to `/sandboxes/{id}`

---

## W3-009: Web — Dashboard Page

**Depends on:** W3-005, W3-008
**Files:** `apps/web/src/app/page.tsx`

### Steps
Dashboard: hero section ("What do you want to ship?") with drag-and-drop zone for instant create, grid of sandbox cards below. Empty state for no sandboxes. Search/filter bar.

### Acceptance Criteria
- [x] Shows hero section with "What do you want to ship?" text
- [x] Hero has drag-and-drop zone for ZIP upload
- [x] Grid of sandbox cards loaded via TanStack Query
- [x] Loading state shown while fetching
- [x] Empty state: "No sandboxes yet. Drop a ZIP to create your first one."
- [x] Search bar filters sandboxes by name
- [x] Cards sorted by most recently updated

---

## W3-010: Web — Deploy Dropzone Component

**Depends on:** W0-013
**Files:** `apps/web/src/components/deploy-dropzone.tsx`

### Steps
Drag-and-drop zone: accepts ZIP/tarball files, shows file name + size after drop, visual feedback on drag-over.

### Acceptance Criteria
- [x] Accepts drag-and-drop of ZIP files
- [x] Click to browse file picker
- [x] Visual highlight on drag-over (border color change)
- [x] Shows file name and size after selection
- [x] Rejects non-ZIP files with error message
- [x] Rejects files > 100 MB with error message
- [x] `onFileSelect(file: File)` callback prop

---

## W3-011: Web — TTL Slider Component

**Depends on:** W0-013
**Files:** `apps/web/src/components/ttl-slider.tsx`

### Steps
Slider from 1-90 days, shows human-readable label ("7 days"), default value 7.

### Acceptance Criteria
- [x] Range 1-90 days
- [x] Default value is 7
- [x] Shows current value as "X days" label
- [x] `onChange(days: number)` callback prop
- [x] Accessible (keyboard navigable, aria labels)

---

## W3-012: Web — Build Log Stream Component

**Depends on:** W0-013
**Files:** `apps/web/src/components/build-log-stream.tsx`

### Steps
Real-time build log viewer: polls API every 2 seconds during build, auto-scrolls to bottom, shows step indicators.

### Acceptance Criteria
- [x] Polls build log API every 2 seconds while status is `"building"`
- [x] Stops polling when status is `"live"` or `"failed"`
- [x] Auto-scrolls to latest log line
- [x] Monospace font for log text
- [x] Shows step progress (e.g., "Step 2/4: Building image...")
- [x] Green checkmark for completed steps, spinner for in-progress

---

## W3-013: Web — Create Sandbox Page

**Depends on:** W3-010, W3-011, W3-012, W3-002
**Files:** `apps/web/src/app/sandboxes/new/page.tsx`

### Steps
Single-page create flow: name input, dropzone, runtime detection display, advanced options (database toggle, TTL slider, access mode radio), "Ship it" button, build log section.

### Acceptance Criteria
- [x] Name input validates URL-safe lowercase (3-63 chars)
- [x] Name validation shows inline error for invalid names
- [x] Dropzone accepts ZIP file
- [x] After file drop: shows detected runtime with confidence indicator
- [x] "Advanced options" collapsible section with database toggle, TTL slider, access radio
- [x] "Ship it" button disabled until name + file provided
- [x] Clicking "Ship it" calls `createSandbox` API
- [x] Build log streams during creation
- [x] On success: shows "Live!" message with URL and "Open" link
- [x] On failure: shows error message with build log

---

## W3-014: Web — Version Timeline Component

**Depends on:** W3-007
**Files:** `apps/web/src/components/version-timeline.tsx`

### Steps
Vertical timeline: each version as a card with number, label, status badge, deployer, relative time, rollback button (for non-live versions).

### Acceptance Criteria
- [x] Vertical timeline layout with connecting line
- [x] Each version shows: `v{N}`, label (if set), status badge, deployer email, relative time
- [x] Live version highlighted (filled circle indicator)
- [x] Non-live versions show "Roll back to this version" button
- [x] Failed versions show error icon, no rollback button
- [x] Versions ordered by number descending (newest first)

---

## W3-015: Web — Sandbox Detail Page

**Depends on:** W3-014, W3-007, W3-003
**Files:** `apps/web/src/app/sandboxes/[id]/page.tsx`

### Steps
Detail page: back button, sandbox name + status badge, URL with copy button + "Open in new tab", current version info, action buttons (Deploy, Share, Extend), version timeline, settings section (expiry, access, destroy).

### Acceptance Criteria
- [x] Shows sandbox name and status badge
- [x] Shows URL with "Copy" button (copies to clipboard)
- [x] "Open in new tab" opens sandbox URL
- [x] Shows current version number, label, deployer, time
- [x] "Deploy new version" button links to deploy page
- [x] "Share" button opens share dialog
- [x] "Extend" button opens extend dialog
- [x] Version timeline loaded via TanStack Query
- [x] Settings section shows expiry date with countdown
- [x] "Destroy sandbox" button with confirmation (type sandbox name)
- [x] Data refreshes on page focus (TanStack Query refetch)

---

## W3-016: Web — Deploy Page

**Depends on:** W3-010, W3-012, W3-003
**Files:** `apps/web/src/app/sandboxes/[id]/deploy/page.tsx`

### Steps
Deploy page for existing sandbox: shows current live version, dropzone for new source, optional label input, build log stream, success/failure display.

### Acceptance Criteria
- [x] Shows current live version info at top
- [x] Dropzone for new source ZIP
- [x] Optional "Version label" text input
- [x] "Deploy" button calls `deployVersion` API
- [x] Build log streams during deployment
- [x] On success: "v{N} is live!" with URL link
- [x] On failure: error message with suggestion

---

## W3-017: Web — Share Dialog Component

**Depends on:** W3-002
**Files:** `apps/web/src/components/share-dialog.tsx`

### Steps
Modal dialog: access mode selector (Just me / My team / Anyone), email input for custom sharing, shareable link display with copy button, "Update access" button.

### Acceptance Criteria
- [x] Three access mode options as radio/button group
- [x] Selecting "Custom" shows email input area
- [x] Email input accepts comma-separated emails
- [x] Shows current sandbox URL with copy button
- [x] "Update access" calls `shareSandbox` API
- [x] Shows success confirmation after update
- [x] Dialog closes on successful update or cancel

---

## W3-018: Web — Extend Dialog

**Depends on:** W3-002, W3-011
**Files:** `apps/web/src/app/sandboxes/[id]/settings/page.tsx` (or inline dialog)

### Steps
Dialog/inline section: current expiry date, TTL slider to set new TTL, "Extend" button.

### Acceptance Criteria
- [x] Shows current expiry date and countdown
- [x] TTL slider (1-90 days)
- [x] "Extend" button calls `extendSandbox` API
- [x] Expiry date updates after successful extension
- [x] Shows success confirmation

---

## W3-019: Web — Login Page

**Depends on:** W3-004
**Files:** `apps/web/src/app/login/page.tsx`

### Steps
Simple login page: Nexus logo, "Sign in with Google" button, redirects to API OAuth flow.

### Acceptance Criteria
- [x] Shows Nexus branding
- [x] "Sign in with Google" button
- [x] Button redirects to `/api/auth/login`
- [x] After successful auth, redirects to dashboard
- [x] Shows error message if auth fails

---

## W3-020: Web — Responsive Layout Test

**Depends on:** W3-009, W3-013, W3-015
**Files:** No new files — verification task

### Steps
Verify all pages render correctly on laptop (1440px), tablet (768px), and large mobile (425px) viewports.

### Acceptance Criteria
- [x] Dashboard: card grid switches from 3-col to 2-col to 1-col
- [x] Create page: form remains usable at 768px
- [x] Detail page: version timeline stacks correctly
- [x] No horizontal scrollbar at any viewport width
- [x] Buttons and interactive elements have adequate touch targets (≥44px)
- [x] Text remains readable at all viewports

---

## Wave 3 — Final Validation

### End-to-End Test (Manual)
```
1. Open http://localhost:3000
2. Click "Sign in with Google" → complete OAuth → return to dashboard
3. Drop a ZIP on the hero dropzone → fill name → click "Ship it"
4. Watch build log stream → see "Live!" with URL
5. Click sandbox card → see detail page with v1
6. Click "Deploy new version" → drop new ZIP → see v2 live
7. Click "Roll back to v1" → confirm → see v1 live
8. Click "Share" → set to "Anyone" → update
9. Click "Extend" → set 30 days → extend
```

### Wave 3 Complete Criteria
- [x] All 20 tasks pass acceptance criteria
- [x] Full create flow works via web UI
- [x] Build log streams in real-time
- [x] Version timeline displays correctly
- [x] Rollback works from UI (confirm dialog → instant)
- [x] Share dialog updates access policy
- [x] Extend updates TTL
- [x] Destroy with type-to-confirm
- [x] Responsive at 1440px, 768px, 425px
- [x] TanStack Query handles loading/error states
