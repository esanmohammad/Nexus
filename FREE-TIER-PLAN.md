# Nexus — Free Tier Development Plan

**Date:** 2026-04-06
**Purpose:** Build and test the full platform using free tiers only, until ready for production.

---

## TL;DR

**Yes, you can build and test the entire platform for $0/month.** No custom domain needed. During testing, sandboxes use Cloud Run's default `.run.app` URLs with IAM-based access control. Cloudflare Zero Trust is added later when you get a domain for production.

---

## 1. Free Tier Mapping

| Component | Spec Requirement | Free Tier Option | Free Limits | Enough for Testing? |
|-----------|-----------------|------------------|-------------|:---:|
| **Compute (sandboxes)** | Cloud Run | GCP Cloud Run free tier | 2M requests/mo, 360K vCPU-seconds, 180K GiB-seconds | Yes — runs ~5-10 sandboxes easily |
| **Compute (control plane)** | Cloud Run | Same free tier (shared) | Same pool | Yes — API + Web UI are lightweight |
| **Container builds** | Cloud Build | GCP Cloud Build free tier | 120 build-minutes/day | Yes — ~20-30 builds/day |
| **Container images** | Artifact Registry | GCP Artifact Registry | 500 MB free storage | Yes — ~10-15 images |
| **Source snapshots** | GCS | GCP Cloud Storage free tier | 5 GB, 1 GB egress/mo | Yes — hundreds of snapshots |
| **Control plane DB** | Cloud SQL | **Neon free tier instead** | 0.5 GB storage, 1 project, auto-suspend | Yes |
| **Sandbox databases** | Neon | Neon free tier | 10 projects (branches unlimited), 0.5 GB each | Yes — 10 sandboxes with DB |
| **Secrets** | Secret Manager | GCP Secret Manager free tier | 6 active secret versions | Tight — use env vars for testing |
| **Job queue** | Cloud Tasks | GCP Cloud Tasks free tier | 1M operations/mo | Yes |
| **Cron** | Cloud Scheduler | GCP Cloud Scheduler free tier | 3 jobs free | Yes — exactly what we need |
| **Auth gateway** | Cloudflare Zero Trust | **Deferred — use Cloud Run IAM** | `--no-allow-unauthenticated` + IAM invoker role | Yes |
| **Tunnel** | Cloudflare Tunnel | **Deferred** | Not needed without custom domain | N/A |
| **DNS** | Cloudflare DNS | **Not needed** | Cloud Run provides `*.run.app` URLs | N/A |
| **Source control** | GitHub | GitHub Free (public or private) | Unlimited private repos | Yes |
| **CI/CD (platform)** | GitHub Actions | GitHub Actions free tier | 2,000 minutes/mo (private repos) | Yes |
| **Slack bot** | Slack API | Slack Free workspace or existing paid | Unlimited bot messages | Yes |
| **MCP Server** | MCP SDK | Open source, self-hosted | No limits | Yes |
| **Monitoring** | Cloud Monitoring | GCP free tier | Basic metrics free | Yes |
| **Logging** | Cloud Logging | GCP free tier | 50 GB/mo ingestion | Yes |

---

## 2. What Changes for Free Tier

### 2.1 Control Plane Database: Cloud SQL → Neon

Cloud SQL has **no free tier** (cheapest is ~$7/mo). Swap it for Neon:

```
Production spec:  Cloud SQL (Postgres) for control plane metadata
Free tier swap:   Neon free tier (1 project, 0.5 GB, auto-suspend after 5 min idle)

Trade-off: Cold starts after idle (adds ~1-2s on first request after inactivity)
Impact:    Fine for testing. Swap back to Cloud SQL for production.
```

This means Neon serves double duty in testing:
- **1 Neon project** → control plane DB
- **Up to 9 more Neon projects** → sandbox databases (free tier = 10 projects)

### 2.2 Simplified Secret Management

Free tier Secret Manager gives 6 active versions. For testing:
- Use Cloud Run **environment variables** for non-sensitive config
- Use Secret Manager only for `DATABASE_URL` and API keys
- Or skip Secret Manager entirely and use `.env` injection during build

### 2.3 Single GCP Project (Not Two)

Production spec calls for two GCP projects (control + workloads). For testing, use one project to avoid managing two billing accounts:

```
Production:  nexus-control + nexus-workloads
Free tier:   nexus-dev (single project, everything here)

Trade-off:   Less isolation between control plane and sandboxes
Impact:      Fine for testing. Split into two projects for production.
```

### 2.4 Screenshot Capture: Playwright → Deferred

Playwright screenshot capture (SPEC-v2 §18.5) requires a headless browser, which needs more memory than free tier Cloud Run easily supports. Defer this to production.

---

## 3. GCP Free Tier Setup

### 3.1 New GCP Account Bonus

If you create a **new** GCP account, you get:
- **$300 free credits** for 90 days (covers everything, even non-free-tier services)
- **Always Free** products (Cloud Run, Cloud Build, GCS, etc.) that continue after 90 days

**Recommendation:** Start with a new GCP account to get $300 credits. Use credits for any overages during active development. After 90 days, the always-free tiers are sufficient for keeping a test environment alive.

### 3.2 Always Free Limits (Post-$300 Credits)

```
Cloud Run:
  - 2 million requests/month
  - 360,000 vCPU-seconds/month (~100 vCPU-hours)
  - 180,000 GiB-seconds/month (~50 GiB-hours)
  - 1 GB outbound networking/month (North America)

Cloud Build:
  - 120 build-minutes/day (e2-small machine)

Cloud Storage:
  - 5 GB-months Standard storage
  - 5,000 Class A operations/month
  - 50,000 Class B operations/month
  - 1 GB outbound/month (North America)

Artifact Registry:
  - 500 MB storage (per region)

Cloud Tasks:
  - First 1 million operations/month

Cloud Scheduler:
  - 3 free jobs per account

Cloud Logging:
  - First 50 GiB/month

Secret Manager:
  - 6 active secret versions
  - 10,000 access operations/month
```

---

## 4. Access Control Without a Domain (Testing Phase)

### Why No Cloudflare Yet

Cloudflare Zero Trust requires a custom domain (`*.nexus.app`). For testing, we skip Cloudflare entirely and use **Cloud Run's built-in IAM** for access control. This is free, secure, and requires no domain.

### How It Works

```
Cloud Run default URL per sandbox:
  https://sandbox-marketing-dash-abc123xyz-uc.a.run.app

Access control via GCP IAM:
  - Deploy with: --no-allow-unauthenticated
  - Grant access: gcloud run services add-iam-policy-binding <service> \
      --member="user:marie@company.com" \
      --role="roles/run.invoker"
  - Users authenticate via: gcloud auth print-identity-token
    or via Cloud Run's Identity-Aware Proxy (IAP)
```

### Access Control Comparison

| | Testing (Cloud Run IAM) | Production (Cloudflare Zero Trust) |
|-|-------------------------|-------------------------------------|
| **URL** | `https://sandbox-name-hash-uc.a.run.app` | `https://name.nexus.app` |
| **Auth** | GCP IAM + `roles/run.invoker` | Cloudflare Access + SSO |
| **User experience** | Users need GCP account or proxy token | Users click link → SSO login → app |
| **Setup cost** | $0 | $0 (domain ~$10/yr) |
| **Effort** | IAM binding per sandbox | Cloudflare API call per sandbox |
| **Good for** | Dev team testing | All team members |

### Simpler Alternative: Cloud Run Proxy

For a better testing UX (so testers don't need GCP accounts), the control plane can act as an **auth proxy**:

```
User → Control Plane Web UI (authenticated via Google OAuth)
     → "Open sandbox" button
     → Control plane proxies request to Cloud Run service
       (using its service account, which has run.invoker role)
     → Returns sandbox app content

URL: https://control-plane-url.run.app/proxy/sandbox-name
```

This gives authenticated access without GCP accounts or Cloudflare. The control plane is the only public-facing service.

### Migration Path to Cloudflare

When ready for production:
```
1. Buy domain (~$10/yr via Cloudflare Registrar or any registrar)
2. Add domain to Cloudflare (free plan)
3. Enable Zero Trust (free for 50 users)
4. Create tunnel (free)
5. Update control plane to create Cloudflare Access apps instead of IAM bindings
6. Sandboxes get clean URLs: https://name.nexus.app
```

The control plane API already has an `access_policy` field on each sandbox. During testing it maps to IAM bindings; in production it maps to Cloudflare policies. Same API, different backend.

---

## 5. Neon Free Tier Setup

```
Free tier includes:
  - 10 projects (1 for control plane + 9 for sandbox DBs)
  - 0.5 GB storage per project
  - Unlimited branches per project
  - Auto-suspend after 5 minutes of inactivity
  - 191.9 compute hours/month

Limitations:
  - Cold start ~1-2s after idle (suspend/resume)
  - 0.5 GB per project (enough for testing, not for large datasets)
  - 10 projects max (limits DB-enabled sandboxes to 9 in testing)
```

---

## 6. What You Can Realistically Test for Free

| Capability | Testable on Free Tier? | Constraints |
|------------|:---:|-------------|
| Create sandbox from ZIP | Yes | Up to ~10 active sandboxes |
| Auto-detect runtime + build | Yes | 120 build-min/day ≈ 20-30 builds |
| Deploy to Cloud Run + get URL | Yes | 2M requests/mo, URLs are `*.run.app` |
| Access control (IAM-based) | Yes | GCP IAM instead of Cloudflare; proxy for non-GCP users |
| Versioning (v1, v2, v3...) | Yes | No limits |
| Rollback (traffic shift) | Yes | Instant, no build cost |
| Source snapshots in GCS | Yes | 5 GB = hundreds of snapshots |
| Neon database per sandbox | Yes | Max 9 DB-enabled sandboxes |
| Neon branching for migrations | Yes | Unlimited branches |
| TTL enforcement + auto-cleanup | Yes | 3 Cloud Scheduler jobs |
| Slack bot | Yes | No cost |
| CLI | Yes | No cost (local binary) |
| MCP server for Claude Code | Yes | No cost (local/self-hosted) |
| GitHub integration | Yes | Free private repos |
| Sharing (IAM bindings or proxy) | Yes | Via GCP IAM or control plane proxy |
| Screenshot diffing | Partial | Needs more memory; defer or run locally |
| Cost dashboard | No | BigQuery billing export not on free tier |
| Multi-project isolation | No | Use single project for testing |

---

## 7. Free Tier Architecture (Simplified)

```
┌───────────────────────────────────────────────────────────────┐
│              GCP Project: nexus-dev                     │
│              (Free Tier + $300 credit)                          │
│                                                                 │
│  Cloud Run (free)        Access: Cloud Run IAM                 │
│  ├── control-plane-api   (--no-allow-unauthenticated)          │
│  │   └── /proxy/*        ← auth proxy for sandbox access       │
│  ├── control-plane-web   (public, Google OAuth login)          │
│  ├── sandbox-a           ← https://sandbox-a-hash-uc.a.run.app│
│  ├── sandbox-b           ← https://sandbox-b-hash-uc.a.run.app│
│  └── sandbox-c           (up to ~10)                           │
│                                                                 │
│  Cloud Build (120 min/day free)                                │
│  Artifact Registry (500 MB free)                               │
│  GCS (5 GB free)                                               │
│  Cloud Tasks (1M ops free)                                     │
│  Cloud Scheduler (3 jobs free)                                 │
│  Secret Manager (6 versions free)                              │
└───────────────────────────────────────────────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────────────────────────────┐
│              Neon (Free Tier)                                   │
│  Project 1: control-plane-db                                   │
│  Project 2-10: sandbox databases                               │
│  (0.5 GB each, auto-suspend, branching)                        │
└───────────────────────────────────────────────────────────────┘

No Cloudflare needed during testing.
Add Cloudflare Zero Trust + custom domain when moving to production.
```

---

## 8. When Free Tier Stops Working

You'll need to start paying when:

| Trigger | Threshold | Estimated Cost |
|---------|-----------|---------------:|
| >10 active sandboxes | Neon project limit | $19/mo (Neon Launch plan, 100 projects) |
| Need clean URLs + SSO | Custom domain + Cloudflare Zero Trust | ~$10/yr domain + $0-3/user/mo |
| Need always-on control plane (no cold starts) | Cloud Run min-instances=1 | $15-30/mo |
| >120 build-min/day | Cloud Build | $0.003/build-second |
| Need Cloud SQL (HA, no suspend) | Replace Neon for control DB | $7-25/mo |
| >5 GB source snapshots | GCS | $0.02/GB/mo |
| Production isolation (2 projects) | IAM/VPC setup | No extra cost, just config |

**Realistic "graduation" cost:** When you move from testing to real internal use with ~20 users and ~10 sandboxes, expect **$50-100/month**.

---

## 9. Development Roadmap on Free Tier

### Sprint 1 (Week 1-2): Foundation
```
Set up:
  ✦ GCP project (free tier, enable billing for $300 credits)
  ✦ Neon account (free)
  ✦ GitHub repo

Build:
  ✦ Control plane API (CRUD sandboxes)
  ✦ GCS snapshot upload
  ✦ Cloud Build trigger (ZIP → image)
  ✦ Cloud Run deploy (image → service, --no-allow-unauthenticated)
  ✦ IAM-based access control (grant run.invoker per sandbox)
  ✦ Auth proxy in control plane (for users without GCP accounts)

Test: Create a sandbox from ZIP, access via control plane proxy URL
```

### Sprint 2 (Week 3-4): Versioning + CLI
```
Build:
  ✦ Version model (v1, v2, v3)
  ✦ Rollback (Cloud Run traffic shift)
  ✦ CLI (create, deploy, rollback, list)
  ✦ TTL scheduler (Cloud Scheduler + cleanup)

Test: Deploy v1, deploy v2, roll back to v1, auto-destroy after TTL
```

### Sprint 3 (Week 5-6): Web UI + Slack
```
Build:
  ✦ Next.js dashboard (create, view, deploy, rollback)
  ✦ Slack bot (create, deploy, status)
  ✦ Neon integration (provision DB, inject DATABASE_URL)

Test: Full flow from Slack and Web UI with database
```

### Sprint 4 (Week 7-8): MCP + Sharing + Polish
```
Build:
  ✦ MCP server (sandbox_create, sandbox_deploy, sandbox_rollback)
  ✦ Sharing (IAM bindings + proxy access)
  ✦ Build log streaming
  ✦ Error recovery UX

Test: Deploy from Claude Code conversation, share with teammates
```

---

## 10. Accounts to Create

| Service | URL | Plan | Card Required? | Needed Now? |
|---------|-----|------|:-:|:-:|
| Google Cloud | console.cloud.google.com | Free ($300 credit) | Yes (not charged) | Yes |
| Neon | console.neon.tech | Free | No | Yes |
| GitHub | github.com | Free | No | Yes |
| Slack | api.slack.com/apps | Free (create app) | No | Sprint 3 |
| Cloudflare | dash.cloudflare.com | Free | No | **Production only** |
| Domain | any registrar | ~$10/year | Yes | **Production only** |

**Total cost to start building: $0**
