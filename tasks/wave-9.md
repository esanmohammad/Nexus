# Wave 9 — Cloudflare Zero Trust (Production Readiness)

**Goal:** Replace Cloud Run IAM with Cloudflare Zero Trust. Custom domain. Production-grade access control.

**Duration:** When domain is purchased and ready
**Depends on:** All previous waves, custom domain available

---

## W9-001: Cloudflare Account Setup

**Depends on:** None (external)
**Files:** Documentation only

### Steps
1. Cloudflare account created
2. Domain added and DNS nameservers pointed to Cloudflare
3. API token generated with Access + DNS + Tunnel permissions
4. `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` available

### Acceptance Criteria
- [x] Domain resolves via Cloudflare DNS
- [x] API token has `Access: Edit`, `DNS: Edit`, `Tunnel: Edit` permissions
- [x] `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` stored in env

---

## W9-002: Cloudflare Tunnel Setup

**Depends on:** W9-001
**Files:** Documentation / infra config

### Steps
1. Create Cloudflare Tunnel
2. Deploy `cloudflared` connector as Cloud Run service
3. Configure tunnel to route `*.nexus.app` to Cloud Run services

### Acceptance Criteria
- [x] Tunnel created and connected
- [x] `cloudflared` running as Cloud Run service
- [x] Wildcard route `*.nexus.app` configured
- [x] Traffic from Cloudflare reaches Cloud Run services
- [x] `CLOUDFLARE_TUNNEL_ID` stored in env

---

## W9-003: Access Service — Create Access App

**Depends on:** W9-001
**Files:** `apps/api/src/services/access.service.ts`

### Steps
Implement `createAccessApp(params)`: create Cloudflare Access Application with access policy based on `accessMode`. Add DNS CNAME record. Add tunnel route.

### Acceptance Criteria
- [x] Creates Access Application via Cloudflare API
- [x] Application name: `sandbox-{name}`
- [x] Domain: `{name}.nexus.app`
- [x] Policy based on `accessMode`:
  - `owner_only` → only owner email
  - `team` → email domain match
  - `anyone` → allow all authenticated users
  - `custom` → specific email list
- [x] CNAME DNS record created pointing to tunnel
- [x] Returns `{ accessAppId, hostname }`

---

## W9-004: Access Service — Update Policy

**Depends on:** W9-003
**Files:** `apps/api/src/services/access.service.ts`

### Steps
Implement `updateAccessPolicy(accessAppId, params)`: update the Access Application's policy rules.

### Acceptance Criteria
- [x] Updates policy to match new `accessMode`
- [x] Adds/removes email rules for `custom` mode
- [x] Changes take effect within seconds
- [x] Does not recreate the application (in-place update)

---

## W9-005: Access Service — Delete Access App

**Depends on:** W9-003
**Files:** `apps/api/src/services/access.service.ts`

### Steps
Implement `deleteAccessApp(accessAppId)`: delete Access Application, DNS record, and tunnel route.

### Acceptance Criteria
- [x] Deletes Access Application
- [x] Deletes CNAME DNS record
- [x] Removes tunnel route
- [x] Idempotent (no error if already deleted)

---

## W9-006: Wire Access Service into Create Flow

**Depends on:** W9-003, W1-019
**Files:** `apps/api/src/services/sandbox.service.ts`

### Steps
Update sandbox create flow: after Cloud Run service created, create Cloudflare Access App. Store `accessAppId` and `hostname` on sandbox. Set `cloud_run_url` to `https://{name}.nexus.app` instead of `*.run.app`.

### Acceptance Criteria
- [x] New sandboxes get `{name}.nexus.app` hostname
- [x] Access Application created with correct policy
- [x] `sandbox.cloud_run_url` set to `https://{name}.nexus.app`
- [x] DNS record created
- [x] Sandbox accessible at custom domain

---

## W9-007: Wire Access Service into Share Flow

**Depends on:** W9-004
**Files:** `apps/api/src/services/sandbox.service.ts`

### Steps
Update share flow: when access policy changes, call `updateAccessPolicy()` on Cloudflare.

### Acceptance Criteria
- [x] Access policy change propagates to Cloudflare within seconds
- [x] New emails can access sandbox immediately after share
- [x] Removed emails are denied access immediately

---

## W9-008: Wire Access Service into Destroy Flow

**Depends on:** W9-005
**Files:** `apps/api/src/services/sandbox.service.ts`

### Steps
Update destroy flow: delete Cloudflare Access App + DNS record before deleting Cloud Run service.

### Acceptance Criteria
- [x] Access Application deleted on sandbox destroy
- [x] DNS record cleaned up
- [x] Tunnel route removed
- [x] Domain no longer resolves after destroy

---

## W9-009: Update Auth — Cloudflare JWT Validation

**Depends on:** W9-001
**Files:** `apps/api/src/middleware/auth.ts`

### Steps
Add Cloudflare Access JWT validation: verify `Cf-Access-Jwt-Assertion` header using Cloudflare's public keys. This replaces Google OAuth for production.

### Acceptance Criteria
- [x] Validates `Cf-Access-Jwt-Assertion` header
- [x] Extracts user email from JWT claims
- [x] Fetches Cloudflare public keys for verification
- [x] Caches public keys (refresh every hour)
- [x] Falls back to Google OAuth if Cloudflare header not present (hybrid mode)

---

## W9-010: Remove Proxy Routes

**Depends on:** W9-002
**Files:** `apps/api/src/routes/proxy.ts`

### Steps
Remove or disable the auth proxy routes (`/api/proxy/:sandboxName/*`). Cloudflare handles proxying and auth. Keep sleeping sandbox page logic (redirect to wake-up page).

### Acceptance Criteria
- [x] Proxy routes removed or disabled in production mode
- [x] Proxy routes still available in development mode (env toggle)
- [x] Sleeping sandbox detection moved to Cloudflare Worker or kept as redirect
- [x] No sandbox is accessible without Cloudflare authentication

---

## Wave 9 — Final Validation

### End-to-End Test
```
1. Create sandbox → verify {name}.nexus.app resolves
2. Access sandbox in browser → Cloudflare login page appears
3. Authenticate → sandbox loads
4. Share with new email → new user can access
5. Remove access → user denied
6. Destroy → domain no longer resolves
```

### Wave 9 Complete Criteria
- [x] All 10 tasks pass acceptance criteria
- [x] New sandboxes get `{name}.nexus.app` hostname
- [x] Cloudflare Zero Trust enforces SSO on all sandbox access
- [x] Access policy changes reflected within seconds
- [x] Tunnel routes traffic correctly
- [x] Destroy cleans up Access App + DNS
- [x] No sandbox accessible without Cloudflare auth
- [x] Proxy routes disabled in production

---
**Status: DONE**
