# Wave 5 — Slack Bot + Notifications

**Goal:** Non-technical users can create and manage sandboxes from Slack. Expiry notifications delivered via Slack.

**Duration:** Week 9-10
**Depends on:** Wave 2 complete
**Status:** DONE
**Status:** DONE

---

## W5-001: Slack App Registration

**Depends on:** None (external setup)
**Status:** DONE
**Files:** Documentation only

### Steps
1. Create Slack App at api.slack.com
2. Configure bot token scopes: `app_mentions:read`, `chat:write`, `files:read`, `im:write`
3. Enable Event Subscriptions: `app_mention`, `message.im`
4. Enable Interactive Components
5. Enable Socket Mode
6. Install to workspace
7. Collect: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`

### Acceptance Criteria
- [x] Slack App created and installed in workspace
- [x] Bot appears in Slack with correct name
- [x] All 3 tokens available: bot token, signing secret, app token
- [x] Socket Mode enabled
- [x] Event subscriptions configured

---

## W5-002: Slack Bot — Package Scaffold

**Depends on:** W5-001
**Status:** DONE
**Files:** `apps/slack-bot/package.json`, `apps/slack-bot/tsconfig.json`, `apps/slack-bot/Dockerfile`

### Steps
Create Slack bot app with `@slack/bolt` dependency and `@nexus/sdk` for API calls.

### Acceptance Criteria
- [x] `apps/slack-bot/package.json` exists with name `@nexus/slack-bot`
- [x] `@slack/bolt` is a dependency
- [x] `@nexus/sdk` is a dependency
- [x] `pnpm --filter @nexus/slack-bot build` succeeds
- [x] Dockerfile exists for Cloud Run deployment

---

## W5-003: Slack Bot — App Initialization

**Depends on:** W5-002
**Status:** DONE
**Files:** `apps/slack-bot/src/index.ts`

### Steps
Initialize Bolt app with socket mode, register all message handlers and action handlers.

### Acceptance Criteria
- [x] App initializes with `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`
- [x] Socket mode enabled
- [x] App starts without errors
- [x] Fails with clear error if env vars missing

---

## W5-004: Slack Bot — Message Parser

**Depends on:** W5-003
**Status:** DONE
**Files:** `apps/slack-bot/src/lib/parser.ts`

### Steps
Parse Slack messages into structured intents: extract command (create/deploy/rollback/status/share/extend/destroy) and arguments (sandbox name, duration, emails).

### Acceptance Criteria
- [x] Parses `"create my-app"` → `{ command: "create", name: "my-app" }`
- [x] Parses `"deploy my-app"` → `{ command: "deploy", name: "my-app" }`
- [x] Parses `"rollback my-app"` → `{ command: "rollback", name: "my-app" }`
- [x] Parses `"status my-app"` → `{ command: "status", name: "my-app" }`
- [x] Parses `"share my-app with @user"` → `{ command: "share", name: "my-app", target: "@user" }`
- [x] Parses `"extend my-app 30d"` → `{ command: "extend", name: "my-app", duration: "30d" }`
- [x] Parses `"destroy my-app"` → `{ command: "destroy", name: "my-app" }`
- [x] Returns `{ command: "unknown" }` for unrecognized input
- [x] Unit test for each parse pattern

---

## W5-005: Slack Bot — Block Kit Builders

**Depends on:** W5-003
**Status:** DONE
**Files:** `apps/slack-bot/src/lib/blocks.ts`

### Steps
Create Block Kit message builders for: deploy success, deploy failure, status view, expiry warning, destroy notice.

### Acceptance Criteria
- [x] `buildDeploySuccessMessage(sandbox, version)` returns blocks with URL, rollback button, share button, extend button
- [x] `buildDeployFailureMessage(sandbox, error)` returns blocks with error summary and retry button
- [x] `buildStatusMessage(sandbox, versions)` returns blocks with sandbox info and version list
- [x] `buildExpiryWarningMessage(sandbox, hoursRemaining)` returns blocks with extend button
- [x] `buildDestroyNoticeMessage(sandbox)` returns informational blocks
- [x] All messages are valid Slack Block Kit JSON
- [x] Buttons have correct `action_id` values

---

## W5-006: Slack Bot — Create Handler

**Depends on:** W5-004, W5-005, W3-001
**Status:** DONE
**Files:** `apps/slack-bot/src/handlers/create.ts`

### Steps
Handle `@nexus create <name>`: check for attached ZIP file, download it, call SDK to create sandbox, post success/failure message.

### Acceptance Criteria
- [x] Responds to `@nexus create <name>` mention
- [x] Detects attached ZIP file in message
- [x] If no ZIP: replies "Please attach a ZIP file with your source code"
- [x] Downloads ZIP from Slack file URL
- [x] Calls `sdk.createSandbox(config, source)`
- [x] Posts build progress as threaded replies (⏳ Building...)
- [x] Posts success message with Block Kit (URL, buttons)
- [x] Posts failure message on build error

---

## W5-007: Slack Bot — Deploy Handler

**Depends on:** W5-004, W5-005
**Status:** DONE
**Files:** `apps/slack-bot/src/handlers/deploy.ts`

### Steps
Handle `@nexus deploy <name>`: similar to create but deploys new version to existing sandbox.

### Acceptance Criteria
- [x] Responds to `@nexus deploy <name>` mention
- [x] Requires attached ZIP file
- [x] Calls `sdk.deployVersion(sandboxId, source, label)`
- [x] Posts threaded build progress
- [x] Posts success/failure Block Kit message

---

## W5-008: Slack Bot — Status Handler

**Depends on:** W5-004, W5-005
**Status:** DONE
**Files:** `apps/slack-bot/src/handlers/status.ts`

### Steps
Handle `@nexus status <name>`: fetch sandbox info, post Block Kit message with details.

### Acceptance Criteria
- [x] Responds to `@nexus status <name>`
- [x] Fetches sandbox via SDK
- [x] Posts Block Kit message with: name, state, URL, current version, TTL, access mode
- [x] Shows version history (last 5 versions)
- [x] Posts "Sandbox not found" if doesn't exist

---

## W5-009: Slack Bot — Rollback Handler

**Depends on:** W5-004, W5-005
**Status:** DONE
**Files:** `apps/slack-bot/src/handlers/rollback.ts`

### Steps
Handle `@nexus rollback <name>`: post confirmation button, on button click execute rollback.

### Acceptance Criteria
- [x] Responds to `@nexus rollback <name>`
- [x] Posts message with confirmation button ("Roll back to v{N}?")
- [x] `rollback_confirm` action handler executes rollback
- [x] Posts success message after rollback
- [x] Shows rolled-back version number

---

## W5-010: Slack Bot — Share, Extend, Destroy Handlers

**Depends on:** W5-004, W5-005
**Status:** DONE
**Files:** `apps/slack-bot/src/handlers/share.ts`, `extend.ts`, `destroy.ts`

### Steps
1. Share: parse target (channel/@user/email), update access
2. Extend: parse duration, call extend API
3. Destroy: post confirmation button, on click execute destroy

### Acceptance Criteria
- [x] `@nexus share my-app with @channel` updates access_mode to `"team"`
- [x] `@nexus share my-app with user@co.com` adds email to allowed list
- [x] `@nexus extend my-app 30d` extends TTL
- [x] `@nexus destroy my-app` posts confirmation button
- [x] `destroy_confirm` action handler destroys sandbox
- [x] All post success/failure messages

---

## W5-011: Slack Bot — Interactive Button Handlers

**Depends on:** W5-006, W5-009, W5-010
**Status:** DONE
**Files:** `apps/slack-bot/src/index.ts` (action registrations)

### Steps
Register action handlers for all buttons: `rollback_confirm`, `destroy_confirm`, `extend_quick`, `open_sandbox`, `share_dialog`.

### Acceptance Criteria
- [x] `rollback_confirm` triggers rollback and updates original message
- [x] `destroy_confirm` triggers destroy and updates original message
- [x] `extend_quick` extends by 7 days and updates message
- [x] `open_sandbox` opens sandbox URL (this is a URL button, no handler needed)
- [x] All button clicks send ephemeral acknowledgment within 3 seconds

---

## W5-012: Notification Service

**Depends on:** W5-005
**Status:** DONE
**Files:** `apps/api/src/services/notification.service.ts`

### Steps
Implement notification service with methods: `sendExpiryWarning(sandbox, hoursRemaining)`, `sendDeploySuccess(sandbox, version)`, `sendDeployFailure(sandbox, error)`, `sendDestroyNotice(sandbox)`. Use Slack Web API to send DMs.

### Acceptance Criteria
- [x] `sendExpiryWarning` sends Slack DM to sandbox owner with extend button
- [x] `sendDeploySuccess` sends DM with sandbox URL and action buttons
- [x] `sendDeployFailure` sends DM with error summary
- [x] `sendDestroyNotice` sends informational DM
- [x] All messages use Block Kit builders from W5-005
- [x] Falls back gracefully if Slack is not configured (log only)

---

## W5-013: Wire Notifications into Cleanup Service

**Depends on:** W5-012, W2-006
**Status:** DONE
**Files:** `apps/api/src/services/cleanup.service.ts`

### Steps
Update cleanup service to call notification service for 72h and 24h expiry warnings instead of just logging.

### Acceptance Criteria
- [x] 72h notification calls `notificationService.sendExpiryWarning(sandbox, 72)`
- [x] 24h notification calls `notificationService.sendExpiryWarning(sandbox, 24)`
- [x] Destroy notification calls `notificationService.sendDestroyNotice(sandbox)`
- [x] Notification failures don't block cleanup cycle

---

## W5-014: Wire Notifications into Deploy Flow

**Depends on:** W5-012, W2-001
**Status:** DONE
**Files:** `apps/api/src/services/version.service.ts`

### Steps
After successful deploy, call `notificationService.sendDeploySuccess()`. After failed deploy, call `notificationService.sendDeployFailure()`.

### Acceptance Criteria
- [x] Successful deploy sends success notification
- [x] Failed deploy sends failure notification
- [x] Notification errors don't cause deploy to fail
- [x] Notifications include correct version number and URL

---

## Wave 5 — Final Validation

### Slack Test
```
1. Open Slack, go to channel with @nexus bot
2. Upload ZIP and type: @nexus create test-slack
3. See build progress threaded replies
4. See success message with Open/Rollback/Share/Extend buttons
5. Type: @nexus status test-slack → see info
6. Type: @nexus rollback test-slack → confirm → rolled back
7. Type: @nexus destroy test-slack → confirm → destroyed
```

### Wave 5 Complete Criteria
- [x] All 14 tasks pass acceptance criteria
- [x] Create sandbox from Slack with attached ZIP
- [x] Deploy new version from Slack
- [x] Status shows sandbox info with Block Kit
- [x] Rollback with confirmation button
- [x] Share/extend/destroy from Slack
- [x] Build progress as threaded replies
- [x] Interactive buttons work
- [x] Expiry notifications sent via Slack DM (72h, 24h)
- [x] Deploy success/failure notifications sent
