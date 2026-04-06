# Nexus — Technology Stack & Tooling

**Version:** 2.0
**Date:** 2026-04-06
**Companion to:** [SPEC.md](./SPEC.md) and [SPEC-v2.md](./SPEC-v2.md)

---

## 1. Stack Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          USER LAYER                                   │
│                                                                       │
│  Web UI          Slack Bot        CLI            MCP Server           │
│  (Next.js)       (Bolt SDK)       (Go binary)    (HTTP/SSE)          │
└──────────────┬───────────────┬──────────────┬──────────────┬─────────┘
               │               │              │              │
               ▼               ▼              ▼              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       CONTROL PLANE                                   │
│                                                                       │
│  API Server (Go or TypeScript) + Async Workers (Cloud Tasks)         │
│  Control DB (Cloud SQL / Neon)                                        │
│  Secret Manager · Pub/Sub · Cloud Scheduler                          │
└──────────────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     BUILD & DEPLOY LAYER                              │
│                                                                       │
│  Cloud Build · Artifact Registry · Cloud Run · GCS                   │
└──────────────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     NETWORKING & ACCESS LAYER                         │
│                                                                       │
│  Cloudflare Zero Trust · Cloudflare Tunnel · Cloudflare DNS          │
└──────────────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     DATA LAYER                                        │
│                                                                       │
│  Neon (sandbox Postgres) · GCS (source snapshots + build logs)       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Platform-by-Platform Breakdown

### 2.1 Google Cloud Platform (GCP)

GCP is the primary cloud provider. All compute, build, and storage runs here.

| Service | Role | Why This Service |
|---------|------|------------------|
| **Cloud Run** | Hosts every sandbox app + the control plane itself | Serverless containers, scale-to-zero (cost), gVisor isolation, instant traffic splitting for rollbacks |
| **Cloud Build** | Builds container images from user source code | Native GCP integration, Dockerfile + buildpack support, connects directly to Artifact Registry |
| **Artifact Registry** | Stores container images (one per sandbox version) | GCP-native Docker registry, IAM-scoped, auto-cleanup policies |
| **Cloud Storage (GCS)** | Stores source snapshots (tarballs), build logs, screenshot captures | Cheap, durable, versioned object storage with lifecycle policies for auto-deletion |
| **Cloud SQL** (PostgreSQL) | Control plane database (sandbox metadata, versions, audit log) | Managed Postgres, automatic backups, HA option, stays within GCP network |
| **Secret Manager** | Stores sandbox secrets (`DATABASE_URL`, user-defined env vars) | IAM-scoped, audit-logged, version-tracked, injected into Cloud Run as secret mounts |
| **Cloud Scheduler** | Triggers TTL enforcement, cleanup jobs, expiry notifications | Managed cron, triggers Cloud Tasks or HTTP endpoints on schedule |
| **Cloud Tasks** | Async job queue for builds, deploys, destroys, notifications | Reliable delivery, retry policies, rate limiting — decouples API from slow infra operations |
| **Pub/Sub** | Event bus for sandbox lifecycle events (created, deployed, destroyed) | Decouples control plane from notification/logging consumers; enables future integrations |
| **VPC + Firewall Rules** | Network isolation for sandbox Cloud Run services | Sandboxes run in a dedicated VPC with no peering to production |
| **IAM + Service Accounts** | Per-sandbox service accounts, least-privilege access | Each sandbox gets its own SA; no SA can access another sandbox's resources |
| **Cloud Logging** | Centralized logs for sandboxes and control plane | Auto-captured from Cloud Run, queryable, exportable to BigQuery |
| **Cloud Monitoring** | Alerts on build failures, stuck sandboxes, cost spikes | Native integration with Cloud Run metrics |
| **BigQuery** | Cost attribution (optional, Phase 4+) | GCP billing export → per-sandbox cost breakdown via resource labels |

**GCP Project Structure:**
```
nexus-control    ← Control plane, Cloud Build, scheduler
nexus-workloads  ← All sandbox Cloud Run services (isolated)
```

Two separate projects ensure the control plane and sandbox workloads have independent IAM boundaries.

---

### 2.2 Cloudflare (Non-Negotiable)

Cloudflare provides the entire access and networking layer. No sandbox is ever exposed without it.

| Service | Role | Why This Service |
|---------|------|------------------|
| **Cloudflare Zero Trust (Access)** | Authentication + authorization for every sandbox URL | Every request to `*.nexus.app` goes through Access. Users authenticate via SSO. Per-sandbox policies control who can access. |
| **Cloudflare Tunnel (cloudflared)** | Secure connection between Cloudflare edge and Cloud Run services | No public IPs on Cloud Run. Tunnels expose services only through Cloudflare. Runs as a connector in GCP. |
| **Cloudflare DNS** | Manages `*.nexus.app` records | Wildcard CNAME to tunnel endpoint. Per-sandbox records created/destroyed by control plane via API. |
| **Cloudflare API** | Programmatic management of Access apps, tunnels, DNS records | Control plane uses Cloudflare API (v4) to create/update/delete Access applications, tunnel routes, and DNS records on every sandbox lifecycle event. |

**Cloudflare Configuration:**
```
Zone: nexus.app (or sandbox.nexus.app)
  ├── Wildcard tunnel route: *.nexus.app → shared tunnel
  ├── Per-sandbox Access Application:
  │   ├── Policy: email in [owner, team, everyone@company.com]
  │   └── IdP: SSO (SAML or OIDC)
  └── Tunnel connector: runs in GCP (Cloud Run sidecar or standalone VM)
```

**SDK/Library:** `cloudflare` Node.js SDK or direct REST API calls from control plane.

---

### 2.3 Neon

Neon provides optional managed Postgres for sandboxes that need a database.

| Feature | Role | Why Neon |
|---------|------|----------|
| **Neon Projects** | One project per sandbox (isolation) | Project-level isolation means one sandbox can never access another's data |
| **Neon Branching** | Safe migrations: branch per version, promote on success | Instant copy-on-write branches enable zero-downtime migrations and instant rollback |
| **Scale to Zero** | Compute suspends when idle | Sandboxes with DBs that aren't accessed don't incur compute cost |
| **Connection Pooling** | Built-in pgbouncer | Cloud Run's ephemeral instances need connection pooling; Neon provides it natively |
| **Neon API** | Programmatic project/branch creation and deletion | Control plane creates/deletes Neon projects and branches via REST API |

**SDK/Library:** `@neondatabase/api` (Node.js) or direct REST API.

**Connection flow:**
```
Cloud Run sandbox → Neon connection string (injected via Secret Manager)
                  → Neon pgbouncer endpoint
                  → Neon project (isolated per sandbox)
                  → Neon branch (isolated per version during migration)
```

---

### 2.4 GitHub

GitHub is optional at creation but becomes required for long-lived sandboxes.

| Feature | Role | Why GitHub |
|---------|------|------------|
| **GitHub Repos** (organization) | Source of truth for promoted/graduated sandboxes | Organization already uses GitHub. Natural home for code that outlives a prototype. |
| **GitHub Webhooks** | Auto-deploy on push to `main` | Push → webhook → control plane → new version. Standard GitOps flow. |
| **GitHub API** | Auto-create repos from source snapshots | When promoting a sandbox, the platform creates a repo and pushes the latest source snapshot as the initial commit. |
| **GitHub Actions** (optional) | CI for graduated sandboxes | Long-lived sandboxes can add tests/linting via standard GH Actions. Platform doesn't require this but supports it. |

**SDK/Library:** `octokit` (Node.js) or `go-github` (Go). GitHub App installed in organization for webhook + API access.

---

### 2.5 Slack

Slack is a primary interaction surface for non-technical users.

| Feature | Role | Why Slack |
|---------|------|-----------|
| **Slack App (Bot)** | `@nexus` bot for create/deploy/rollback/status/share/destroy | Non-technical users live in Slack. They should never need to leave. |
| **Slack Block Kit** | Rich interactive messages with buttons (Open, Roll Back, Share, Extend) | Users click buttons instead of typing commands. Lowers barrier. |
| **Slack File Uploads** | Accept ZIP attachments for deploy | Users can drag a ZIP into Slack and deploy it in one message. |
| **Slack Webhooks (incoming)** | Notifications: build status, expiry warnings, destroy confirmations | Users get proactive updates in the channel where they created the sandbox. |

**SDK/Library:** `@slack/bolt` (Node.js) or `slack-go` (Go). Slack App with Bot Token + Event Subscriptions + Interactive Components.

---

## 3. Control Plane Technology Choices

### 3.1 API Server

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Go** | Fast, small binaries, excellent concurrency, strong GCP SDK | Smaller ecosystem for web UI, team may have less Go experience | **Recommended if team has Go skills** |
| **TypeScript (Node.js)** | Same language as Web UI, large ecosystem, faster iteration | Heavier runtime, less type safety for infra operations | **Recommended if team is JS-heavy** |

**Framework (if TypeScript):** Hono or Fastify (lightweight, fast) — not Express (too minimal for structured APIs) or NestJS (too heavy).

**Framework (if Go):** Standard library `net/http` + `chi` router — no heavy frameworks needed.

### 3.2 Web UI

| Technology | Role |
|------------|------|
| **Next.js 15 (App Router)** | Web dashboard for sandbox management |
| **React 19** | UI components |
| **Tailwind CSS v4** | Styling |
| **shadcn/ui** | Component library (accessible, customizable) |
| **TanStack Query** | Server state management, real-time polling |
| **Zod** | Schema validation (shared with API) |

**Hosting:** Deployed as a Cloud Run service (same project as control plane API).

### 3.3 CLI

| Technology | Role |
|------------|------|
| **Go** (preferred) or **TypeScript (oclif)** | `nexus` CLI binary |
| **OAuth2 PKCE** | Browser-based login flow |
| **JSON + table output** | Human-readable tables by default, `--json` for scripting |

**Distribution:** Homebrew tap (`brew install nexus/tap/nexus`), direct binary download, or npm global install (if TS).

### 3.4 MCP Server

| Technology | Role |
|------------|------|
| **TypeScript** | MCP server implementing the Model Context Protocol |
| **`@modelcontextprotocol/sdk`** | Official MCP SDK for tool registration and transport |
| **HTTP + SSE transport** | Claude Code connects via stdio or HTTP |

**Tools exposed:**
```
sandbox_create    sandbox_deploy    sandbox_rollback
sandbox_status    sandbox_share     sandbox_logs
sandbox_list      sandbox_destroy   sandbox_extend
```

**Distribution:** npm package (`@nexus/sandbox-mcp`) that users add to their Claude Code MCP config.

---

## 4. Build & Deploy Pipeline Tools

| Tool | Role | Details |
|------|------|---------|
| **Cloud Build** | Container image builder | Triggered by control plane API. Uses either user-provided Dockerfile or auto-generated one from buildpack detection. |
| **Buildpacks (Google Cloud Buildpacks)** | Auto-containerize apps without Dockerfile | `gcr.io/buildpacks/builder` detects Node.js, Python, Go, Java, .NET and builds optimized images. Fallback when no Dockerfile provided. |
| **Artifact Registry** | Docker image storage | Images tagged as `{region}-docker.pkg.dev/nexus-workloads/sandboxes/{sandbox-name}:v{N}` |
| **Kaniko** (optional) | Rootless container builds | Alternative to Cloud Build for faster, in-cluster builds if needed at scale. |

**Build flow:**
```
Source (ZIP/tarball)
  → GCS (snapshot)
  → Cloud Build:
      Has Dockerfile? → docker build
      No Dockerfile?  → buildpack detect → buildpack build
  → Artifact Registry (tagged image)
  → Cloud Run (new revision)
```

---

## 5. Observability & Monitoring Stack

| Tool | Role | Details |
|------|------|---------|
| **Cloud Logging** | Centralized logs | Auto-captured from Cloud Run (sandboxes + control plane). Filtered by sandbox labels. |
| **Cloud Monitoring** | Metrics + alerts | Cloud Run metrics (request count, latency, CPU, memory). Custom metrics for sandbox lifecycle events. |
| **Cloud Trace** (optional) | Distributed tracing | Trace requests through control plane → Cloud Build → Cloud Run → Cloudflare. |
| **Sentry** (optional) | Error tracking for control plane | Catches unhandled exceptions in API server and Web UI. Not for sandbox apps. |
| **Playwright** | Screenshot capture | Headless browser captures screenshot of each deployed version for visual diffing (see SPEC-v2 §18.5). Runs as a Cloud Run job post-deploy. |

---

## 6. CI/CD for the Platform Itself

The sandbox platform's own code (control plane, Web UI, CLI) needs its own CI/CD:

| Tool | Role |
|------|------|
| **GitHub Actions** | CI: lint, test, build for every PR |
| **Cloud Build triggers** | CD: deploy control plane to Cloud Run on merge to `main` |
| **Terraform** | Infrastructure as Code for GCP resources (projects, VPCs, IAM, Cloud SQL, buckets) |
| **Cloudflare Terraform Provider** | IaC for Cloudflare zone, tunnel, wildcard DNS |
| **Neon Terraform Provider** (if available) or API scripts | IaC for Neon project templates |

**Repository structure:**
```
nexus/
├── apps/
│   ├── api/              ← Control plane API server
│   ├── web/              ← Next.js Web UI
│   ├── cli/              ← CLI tool
│   ├── mcp-server/       ← MCP server for Claude Code
│   └── slack-bot/        ← Slack app
├── packages/
│   ├── shared/           ← Shared types, validation schemas (Zod)
│   ├── sdk/              ← TypeScript SDK for API (used by web, cli, mcp, slack)
│   └── db/               ← Database schema, migrations (Drizzle or Prisma)
├── infra/
│   ├── terraform/        ← GCP + Cloudflare IaC
│   └── dockerfiles/      ← Base images, buildpack configs
├── docs/                 ← Internal documentation
└── .github/
    └── workflows/        ← CI/CD pipelines
```

**Monorepo tooling:** Turborepo (if TypeScript-heavy) or Nx. If Go-heavy, standard Go workspace.

---

## 7. Authentication & Identity

| Component | Tool | Details |
|-----------|------|---------|
| **Identity Provider** | SSO (SAML or OIDC via Google Workspace / Okta / Azure AD) | Must confirm with security team which IdP is in use |
| **Web UI auth** | Cloudflare Access JWT | `Cf-Access-Jwt-Assertion` header validated by API server |
| **CLI auth** | OAuth2 PKCE flow | Browser popup → IdP → short-lived JWT stored locally |
| **API auth** | JWT Bearer tokens | Validated against IdP JWKS endpoint |
| **Slack auth** | Slack user ID → company email mapping | Slack app resolves user identity; control plane maps to SSO identity |
| **MCP auth** | OAuth2 or API key | Claude Code authenticates via `nexus login` (same as CLI) |
| **Service-to-service** | GCP IAM + Workload Identity | Control plane → Cloud Build, Cloud Run, GCS, Secret Manager, Neon API |

---

## 8. Third-Party APIs & SDKs

| API/SDK | Purpose | Used By |
|---------|---------|---------|
| **Cloudflare API v4** | Create/update/delete Access apps, tunnels, DNS | Control plane API |
| **Neon API** | Create/delete projects and branches, get connection strings | Control plane API |
| **GitHub API (via GitHub App)** | Create repos, push code, manage webhooks | Control plane API |
| **Slack API (via Bolt SDK)** | Bot messages, interactive components, file uploads | Slack bot |
| **Google Cloud Client Libraries** | Cloud Run Admin, Cloud Build, GCS, Secret Manager, IAM, Pub/Sub, Cloud Tasks, Cloud Scheduler | Control plane API |
| **MCP SDK** (`@modelcontextprotocol/sdk`) | Implement MCP tools for Claude Code | MCP server |
| **Playwright** | Headless browser for screenshot capture | Post-deploy job |
| **Resend or SendGrid** (optional) | Email notifications (expiry, build status) | Control plane scheduler |

---

## 9. Security Tools

| Tool | Purpose |
|------|---------|
| **Cloudflare Zero Trust** | Every sandbox request authenticated via SSO |
| **GCP VPC + Firewall** | Sandbox network isolation, egress restrictions |
| **GCP IAM** | Least-privilege service accounts per sandbox |
| **Secret Manager** | Encrypted secret storage with audit trail |
| **Cloud Run gVisor** | Container sandboxing (default in Cloud Run) |
| **Trivy** (optional) | Container image vulnerability scanning on build |
| **Dependabot / Renovate** | Dependency updates for the platform's own code |

---

## 10. Cost Management Tools

| Tool | Purpose |
|------|---------|
| **GCP Resource Labels** | Every resource tagged with `sandbox={name}`, `owner={email}`, `team={team}` |
| **GCP Billing Export → BigQuery** | Raw cost data per labeled resource |
| **Looker Studio or Metabase** (optional) | Cost dashboard for platform admins |
| **Cloud Run scale-to-zero** | Sandboxes with no traffic incur zero compute cost |
| **Neon scale-to-zero** | Idle databases suspend automatically |
| **GCS Lifecycle Policies** | Auto-delete source snapshots 30 days after sandbox destruction |
| **Artifact Registry Cleanup Policies** | Auto-delete images for destroyed sandboxes |

---

## 11. Development Tools (For Platform Team)

| Tool | Purpose |
|------|---------|
| **TypeScript 5.x** | Primary language (API, Web UI, MCP, Slack bot, SDK) |
| **Go 1.23+** | CLI (optionally API server) |
| **pnpm** | Package manager (monorepo workspaces) |
| **Turborepo** | Monorepo build orchestration |
| **Vitest** | Unit + integration testing |
| **Playwright** | E2E testing for Web UI |
| **ESLint + Prettier** | Code quality |
| **Drizzle ORM** | Type-safe database access for control plane DB |
| **Docker** | Local development containers |
| **Terraform 1.9+** | Infrastructure provisioning |
| **act** (optional) | Run GitHub Actions locally |

---

## 12. Full Dependency Map

```
                        ┌──────────────┐
                        │  SSO   │ (IdP: Google Workspace / Okta / Azure AD)
                        └──────┬───────┘
                               │ SAML/OIDC
                               ▼
┌──────────┐  ┌──────────────────────────────────┐  ┌─────────────┐
│  Slack   │  │        Cloudflare                 │  │  GitHub     │
│  API     │  │  Zero Trust · Tunnel · DNS        │  │  API        │
└────┬─────┘  └──────────────┬───────────────────┘  └──────┬──────┘
     │                       │                              │
     ▼                       ▼                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                    CONTROL PLANE (GCP)                              │
│                                                                     │
│  API Server ←→ Cloud SQL (metadata)                                │
│      │                                                              │
│      ├──→ Cloud Build ──→ Artifact Registry                        │
│      ├──→ Cloud Run Admin (deploy/destroy sandboxes)               │
│      ├──→ GCS (source snapshots, build logs)                       │
│      ├──→ Secret Manager (sandbox secrets)                         │
│      ├──→ Cloud Tasks (async jobs)                                 │
│      ├──→ Cloud Scheduler (TTL enforcement, cron)                  │
│      ├──→ Pub/Sub (lifecycle events)                               │
│      ├──→ Neon API (DB provisioning, branching)                    │
│      ├──→ Cloudflare API (Access apps, tunnels, DNS)               │
│      ├──→ GitHub API (repo creation, webhooks)                     │
│      └──→ Slack API (notifications, interactive messages)          │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌──────────────────┐
│  Cloud Run      │    │  Neon            │
│  (sandbox apps) │    │  (sandbox DBs)   │
└─────────────────┘    └──────────────────┘
```

---

## 13. Vendor Lock-in Assessment

| Component | Vendor | Lock-in Risk | Mitigation |
|-----------|--------|:---:|------------|
| Compute | GCP Cloud Run | Medium | Cloud Run is OCI containers — portable to any container platform (Fly.io, Railway, K8s) |
| Build | GCP Cloud Build | Low | Can swap for GitHub Actions, Buildkite, or self-hosted Kaniko |
| Storage | GCS | Low | S3-compatible API; easy to migrate to any object store |
| Control DB | Cloud SQL | Low | Standard Postgres; can move to Neon, RDS, or self-hosted |
| Container Registry | Artifact Registry | Low | OCI standard; can use Docker Hub, GHCR, ECR |
| Sandbox DB | Neon | Medium | Standard Postgres wire protocol. Can migrate to Cloud SQL, RDS, Supabase. Neon branching is the differentiator — no direct equivalent elsewhere. |
| Access | Cloudflare Zero Trust | **High (by design)** | Non-negotiable requirement. Deep integration. Migrating would require rearchitecting access layer. |
| DNS | Cloudflare | Medium | Standard DNS; can move but tightly coupled to Zero Trust |
| Notifications | Slack | Low | Webhook-based; can add Teams, Discord, email as additional channels |
| Source control | GitHub | Low | Standard Git; platform stores source snapshots independently |

---

## 14. Estimated Service Costs (Monthly)

### Platform Fixed Costs

| Service | Estimated Cost | Notes |
|---------|---------------:|-------|
| Cloud Run (control plane, 2 services) | $30–60 | API + Web UI, always-on min 1 instance |
| Cloud SQL (control DB, db-f1-micro) | $10–30 | Smallest instance, sufficient for metadata |
| Cloud Scheduler | $0.10 | 3 cron jobs |
| Cloudflare Zero Trust | $0 (50 users free) or $3/user | Depends on existing plan |
| GitHub (organization) | $0 | Already paid for |
| Slack (workspace) | $0 | Already paid for |
| **Total fixed** | **~$50–100** | |

### Per-Sandbox Variable Costs

| Service | Idle | Light Use | Notes |
|---------|-----:|----------:|-------|
| Cloud Run | $0 | $5–15 | Scale-to-zero eliminates idle cost |
| Neon (if enabled) | $0 | $0–5 | Free tier covers most sandboxes |
| Artifact Registry | $0.10 | $0.10 | Per image stored |
| GCS | $0.01 | $0.05 | Source snapshots |
| Cloud Build | — | $0.50–2 | Per build minute |
| Secret Manager | $0.06 | $0.06 | Per secret per month |
| **Total per sandbox** | **~$0.17** | **~$6–22** | |

### Projected Monthly Cost (50 active sandboxes)

| Scenario | Estimate |
|----------|--------:|
| 50 sandboxes, mostly idle | ~$150 |
| 50 sandboxes, moderate use | ~$500 |
| 50 sandboxes, heavy use + DBs | ~$1,200 |
