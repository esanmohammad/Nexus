# Nexus — Product Specification

**Version:** 2.0
**Date:** 2026-04-06
**Status:** RFC

---

## 0. Inspiration & Prior Art

This spec is informed by two key references:

### Stripe Minions

Stripe's autonomous coding agents produce 1,300+ PRs/week with zero human-written code. Key lessons for our platform:

| Stripe Concept | Our Adaptation |
|----------------|----------------|
| **Devboxes** — pre-warmed EC2 instances that spin up in ~10 seconds, fully isolated from production and the internet. Agents run with full permissions because the sandbox itself is the security boundary. | Our sandboxes follow the same model: Cloud Run services in an isolated VPC with no production access. The sandbox *is* the trust boundary, so apps inside can do anything without risk. |
| **Blueprints** — hybrid workflows mixing deterministic nodes (linting, git push, test selection) with agentic nodes (implement task, fix CI). This constrains LLM scope, saves tokens, and guarantees predictable subtasks. | Our deploy pipeline uses the same pattern: deterministic steps (snapshot source → build image → push to registry → create revision) with optional agentic steps (auto-detect runtime, suggest Dockerfile, generate migration plan). |
| **Toolshed (MCP server)** — centralized server with ~500 tools for documentation, tickets, build status, code intelligence. Agents get curated tool subsets per task, not the full catalog. | Our control plane exposes a focused MCP tool surface: `create_sandbox`, `deploy_version`, `rollback`, `share`, `get_logs`, `get_status`. Claude Code users can deploy directly from their conversation. |
| **Slack-native dispatch** — engineers tag a Minion in any Slack thread; the agent ingests the full thread context (stack traces, links, prior discussion) and produces a PR. | Our platform supports Slack-triggered deploys: paste a ZIP or repo link in a thread, tag `@nexus`, and get a live URL back. Non-technical users never leave Slack. |
| **Shift feedback left** — local linting in <5s before CI, autofix on first CI failure, max 2 push iterations. | Our build pipeline validates locally (Dockerfile syntax, port detection, dependency resolution) before pushing to Cloud Build, with one auto-retry on build failure. |
| **Human review of agent output** — Minions write all the code, but humans always review before merge. | Every sandbox version is created by a human action (click "Deploy" or tag in Slack). There's no fully autonomous deployment — the human is always in the loop for the "ship it" decision. |

### DevBox.gg

DevBox positions itself as "AI-Native Software Delivery Orchestration" — the intent-to-deploy pipeline for teams using Claude Code, Cursor, and similar tools. Key influence:

| DevBox Concept | Our Adaptation |
|----------------|----------------|
| **Intent-to-deploy** — the idea that the unit of work is not a commit or PR, but an *intent* ("I want this dashboard live"). The platform orchestrates everything between intent and running app. | Our core UX is exactly this: the user's intent is "make this app available at a URL." The platform handles build, deploy, DNS, auth, and cleanup. No CI/CD pipeline to configure. |
| **AI-native workflow** — designed from scratch for AI-generated code, not retrofitted onto traditional CI/CD. | We assume most code is Claude Code-generated. The platform optimizes for the "generate → deploy → iterate" loop, not the traditional "branch → PR → review → merge → deploy" flow. |
| **Orchestration, not just hosting** — DevBox isn't just a runtime; it orchestrates the full lifecycle from code to deployed service. | Our control plane is an orchestrator: it manages the full lifecycle (provision → build → deploy → version → share → cleanup) and exposes it as simple product actions. |

---

## 1. Problem Statement

Teams increasingly use Claude Code to generate internal web applications (dashboards, admin tools, data explorers, prototypes). Today, shipping these apps requires infrastructure knowledge, manual Cloud Run setup, networking configuration, and security review. This creates a bottleneck: non-technical users can generate apps but cannot deploy them, and technical users spend disproportionate time on infra plumbing instead of product work.

**Goal:** A self-service internal platform where any team member can publish, version, share, and destroy isolated web apps with zero infrastructure knowledge.

---

## 2. Guiding Principles

| Principle | Implication |
|-----------|-------------|
| **Zero-trust by default** | Every sandbox is behind Cloudflare Zero Trust. No public endpoints, ever. |
| **Isolation is non-negotiable** | Sandboxes cannot reach production systems, other sandboxes, or the control plane's internal APIs. |
| **Ephemeral by default, durable by choice** | Every sandbox has a mandatory TTL. Long-lived apps require explicit promotion and eventually a GitHub repo. |
| **Product UX, not infra UX** | Users see "versions", not revisions/images/commits. They click "Roll back", not `gcloud run services update-traffic`. |
| **Reproducibility** | Every deployed version can be rebuilt from its snapshot at any point in the future. |

---

## 3. Target Users

| Persona | Description | Primary Actions |
|---------|-------------|-----------------|
| **Creator** | Non-technical user (PM, analyst, ops) who generates an app with Claude Code and wants to ship it internally | Create sandbox, deploy, share link |
| **Developer** | Technical user who builds more complex apps, needs DB, wants GitHub integration | All Creator actions + DB provisioning, GitHub sync, migration management |
| **Team Lead** | Manages a team's sandboxes, controls access and budgets | View team sandboxes, extend TTLs, transfer ownership, set quotas |
| **Platform Admin** | SRE/Infra team member who operates the platform itself | Global dashboard, force-destroy, audit logs, cost monitoring |

---

## 4. Core Concepts

### 4.1 Sandbox

A sandbox is the top-level resource. It represents one isolated application.

```
Sandbox
├── name: string (unique, URL-safe, e.g. "marketing-dashboard")
├── owner: NexusUser
├── team: string (optional)
├── hostname: "{name}.nexus.app"
├── ttl: duration (default 7d, max 90d, extendable)
├── expires_at: timestamp
├── state: creating | running | sleeping | destroying | destroyed
├── access_policy: AccessPolicy
├── versions: Version[]
├── database: Database? (optional)
├── created_at: timestamp
└── metadata: map<string, string>
```

### 4.2 Version

A version is an immutable, numbered deployment of a sandbox. Users never interact with container images, Git SHAs, or Cloud Run revisions directly.

```
Version
├── number: uint (auto-incremented: v1, v2, v3…)
├── label: string (optional, user-facing, e.g. "Added filters")
├── status: building | live | rolled-back | failed
├── source_snapshot_url: GCS URL (tarball of source at deploy time)
├── container_image: Artifact Registry URL
├── cloud_run_revision: string
├── db_migration: MigrationPlan? (optional)
├── created_by: NexusUser
├── created_at: timestamp
└── build_logs_url: string
```

**Key invariants:**
- Versions are append-only. You cannot edit a version, only create a new one.
- Exactly one version is `live` at any time.
- Rolling back creates no new version — it re-points traffic to a previous version's existing revision.
- Source snapshots are retained for the lifetime of the sandbox + 30-day grace period.

### 4.3 Database (Optional)

```
Database
├── provider: "neon"
├── project_id: string (Neon project)
├── branch: string (Neon branch, one per version for migrations)
├── connection_string: string (injected as env var)
├── size_limit: bytes (default 1 GB)
└── state: provisioning | ready | destroying | destroyed
```

Each sandbox gets at most one Neon project. Neon branching is used for safe migrations: a new branch is created per version, migration is applied, and on success the branch becomes the main branch. On rollback, traffic switches to the previous branch.

### 4.4 Access Policy

```
AccessPolicy
├── mode: "owner-only" | "team" | "anyone-in-org" | "custom"
├── allowed_emails: string[] (for custom mode)
└── cloudflare_policy_id: string
```

All modes are enforced via Cloudflare Zero Trust Access policies. There is no "public" mode.

---

## 5. User Flows

### 5.1 Create Sandbox

```
User → Control Plane UI/CLI
  1. Enter sandbox name (validated: unique, URL-safe)
  2. Upload source (drag-and-drop ZIP/tarball, or paste GitHub repo URL)
  3. Select runtime (auto-detected or manual: Node.js, Python, static)
  4. Optionally enable Postgres
  5. Set TTL (default 7 days, slider: 1d–90d)
  6. Set access (default: owner-only)
  7. Click "Create"

Control Plane → Infrastructure
  1. Store source snapshot in GCS
  2. Build container image via Cloud Build
  3. Create Cloud Run service (isolated VPC, no egress to prod)
  4. If DB requested: provision Neon project + initial branch
  5. Inject DATABASE_URL, SANDBOX_ID, VERSION env vars
  6. Create Cloudflare Access application + DNS record
  7. Mark sandbox as "running", version as "v1 live"
  8. Return URL: https://{name}.nexus.app
```

**Time target:** < 3 minutes from click to live URL.

### 5.2 Deploy New Version

```
User → Control Plane
  1. Navigate to sandbox
  2. Upload new source (or "sync from GitHub" if repo-backed)
  3. Optionally add a label ("Fixed the chart colors")
  4. If DB exists, optionally upload migration SQL
  5. Click "Deploy"

Control Plane → Infrastructure
  1. Store new source snapshot (v{N})
  2. Build new container image
  3. If migration exists:
     a. Create Neon branch from current main
     b. Apply migration to branch
     c. Run validation (connection test, schema diff preview)
  4. Deploy new Cloud Run revision
  5. Shift 100% traffic to new revision
  6. If migration succeeded: promote Neon branch to main
  7. Mark version as "live", previous version as "rolled-back"
```

### 5.3 Roll Back

```
User → Control Plane
  1. Navigate to sandbox → Versions tab
  2. See version history (v3 live, v2, v1)
  3. Click "Roll back to v2"
  4. Confirm

Control Plane → Infrastructure
  1. Shift Cloud Run traffic to v2's revision (instant, no rebuild)
  2. If DB: switch Neon branch pointer back to v2's branch
  3. Mark v2 as "live", v3 as "rolled-back"
```

**Time target:** < 10 seconds (no build, just traffic shift).

### 5.4 Share Internally

```
User → Control Plane
  1. Navigate to sandbox → Sharing
  2. Choose: "My team", "Anyone in the organization", or enter specific emails
  3. Click "Update access"
  4. Copy shareable link

Control Plane → Cloudflare
  1. Update Zero Trust Access policy with new allowed identities
  2. Viewers authenticate via SSO (already in Cloudflare IdP)
```

### 5.5 Extend Lifetime

```
User → Control Plane
  1. Receives email/Slack notification: "Your sandbox expires in 24h"
  2. Clicks "Extend" in notification or navigates to sandbox
  3. Selects new TTL extension (7d, 30d, 90d)
  4. If extending beyond 30d total: prompted to connect a GitHub repo

Control Plane
  1. Updates expires_at
  2. If > 30d and no repo: flags as "needs repo" (soft warning, not blocking)
  3. If > 90d: requires Platform Admin approval
```

### 5.6 Destroy Sandbox

```
User → Control Plane
  1. Navigate to sandbox → Settings → "Destroy sandbox"
  2. Type sandbox name to confirm
  3. Click "Destroy"

Control Plane → Infrastructure (async)
  1. Set sandbox state to "destroying"
  2. Delete Cloud Run service
  3. Delete Cloudflare Access app + DNS record
  4. Delete Neon project (if exists)
  5. Retain source snapshots for 30 days (audit trail), then delete
  6. Mark sandbox as "destroyed"
```

### 5.7 Automatic Cleanup (TTL Expiry)

```
Scheduler (runs every 15 minutes)
  1. Query sandboxes where expires_at < now()
  2. For each:
     a. Send final "destroyed" notification to owner
     b. Execute destroy flow (same as 5.6)
  3. Query sandboxes where expires_at < now() + 24h AND not yet notified
     a. Send "expiring soon" notification
```

### 5.8 Slack-Native Deploy (Inspired by Stripe Minions)

Non-technical users can deploy without ever leaving Slack:

```
User → Slack
  1. In any Slack channel, tag @nexus:
     "@nexus create marketing-dash from <attached ZIP>"
     or
     "@nexus deploy marketing-dash" (with ZIP attached)
     or
     "@nexus status marketing-dash"

Slack Bot → Control Plane
  1. Parse intent from message (create / deploy / status / rollback / destroy)
  2. Extract attachments (ZIP) or repo URL from thread context
  3. Execute corresponding API call
  4. Post threaded reply with:
     - Build progress (⏳ Building... → ✅ Live!)
     - Live URL: https://marketing-dash.nexus.app
     - Quick action buttons: [Open] [Roll Back] [Share] [Extend] [Destroy]
```

Supported Slack commands:
| Command | Action |
|---------|--------|
| `@nexus create <name>` (+ ZIP/repo) | Create new sandbox |
| `@nexus deploy <name>` (+ ZIP) | Deploy new version |
| `@nexus rollback <name>` | Roll back to previous version |
| `@nexus status <name>` | Show sandbox status + URL |
| `@nexus share <name> with @channel` | Share with channel members |
| `@nexus extend <name> 30d` | Extend TTL |
| `@nexus destroy <name>` | Destroy (requires confirmation reaction) |

### 5.9 Claude Code MCP Integration

Claude Code users can deploy directly from their coding session via MCP tools exposed by the control plane:

```
Available MCP Tools (exposed by nexus MCP server):

sandbox_create(name, runtime?, db?, ttl?, access?)
  → Creates sandbox, returns URL

sandbox_deploy(name, source_path)
  → Snapshots local directory, builds, deploys, returns version info

sandbox_rollback(name, version?)
  → Rolls back to specified or previous version

sandbox_status(name)
  → Returns current state, live version, URL, TTL remaining

sandbox_share(name, mode, emails?)
  → Updates access policy

sandbox_logs(name, type: "build" | "runtime")
  → Returns recent logs

sandbox_list()
  → Lists user's sandboxes with status
```

**Usage in Claude Code:**
```
User: "Deploy this app as a sandbox called analytics-tool"
Claude Code: [calls sandbox_deploy("analytics-tool", "./")]
  → "Your app is live at https://analytics-tool.nexus.app (v1)"

User: "The chart is broken, roll back"
Claude Code: [calls sandbox_rollback("analytics-tool")]
  → "Rolled back to v1. Live at https://analytics-tool.nexus.app"
```

This means the full loop — generate code → deploy → test → iterate → share — happens inside a single Claude Code conversation without context-switching.

---

## 6. Architecture

### 6.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare Edge                          │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  Zero Trust       │  │  DNS             │                    │
│  │  Access Gateway   │  │  *.sandbox.      │                    │
│  │  (SSO + policies) │  │   nexus.app    │                    │
│  └────────┬─────────┘  └────────┬─────────┘                    │
└───────────┼──────────────────────┼──────────────────────────────┘
            │                      │
            ▼                      ▼
┌───────────────────────────────────────────────────────────────┐
│                     Google Cloud Project                       │
│                    "nexus"                     │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Control Plane (Cloud Run)                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐ │  │
│  │  │ API      │ │ Web UI   │ │ Scheduler │ │ Builder   │ │  │
│  │  │ Server   │ │ (Next.js)│ │ (cron)    │ │ (async)   │ │  │
│  │  └──────────┘ └──────────┘ └───────────┘ └───────────┘ │  │
│  │         │                                      │         │  │
│  │         ▼                                      ▼         │  │
│  │  ┌──────────────┐                    ┌──────────────┐   │  │
│  │  │ Control DB   │                    │ Cloud Build  │   │  │
│  │  │ (Cloud SQL   │                    │ (image build)│   │  │
│  │  │  or Neon)    │                    └──────────────┘   │  │
│  │  └──────────────┘                                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Sandbox VPC (isolated)                       │  │
│  │                                                           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                │  │
│  │  │ Sandbox  │ │ Sandbox  │ │ Sandbox  │  ...            │  │
│  │  │ A (CR)   │ │ B (CR)   │ │ C (CR)   │                │  │
│  │  └──────────┘ └──────────┘ └──────────┘                │  │
│  │       │                                                   │  │
│  │       ▼ (only if DB enabled)                             │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
└───────────────────────────────────────────────────────────────┘
            │
            ▼ (external, only for DB-enabled sandboxes)
┌───────────────────────┐
│  Neon (managed)       │
│  ┌─────┐ ┌─────┐     │
│  │Proj │ │Proj │ ... │
│  │  A  │ │  B  │     │
│  └─────┘ └─────┘     │
└───────────────────────┘
```

### 6.2 Network Isolation Model

| Path | Allowed? | Mechanism |
|------|----------|-----------|
| Internet → Sandbox | Only via Cloudflare tunnel | Cloud Run ingress = "internal + cloudflare" |
| Sandbox → Internet | Blocked by default; allowlist for npm/pip registries | VPC egress firewall rules |
| Sandbox → Production | **Blocked** | Separate GCP project, no VPC peering, no shared service accounts |
| Sandbox → Sandbox | **Blocked** | Each Cloud Run service uses a dedicated service account; no inter-service auth |
| Sandbox → Neon | Allowed (own DB only) | Connection string scoped to own Neon project; IP allowlist |
| Control Plane → Sandbox | Deploy/destroy only | Service account with `run.admin` on sandbox project only |

### 6.3 Component Responsibilities

| Component | Tech | Responsibility |
|-----------|------|----------------|
| **API Server** | Go or Node.js (Cloud Run) | REST/gRPC API for all sandbox CRUD, version management, auth |
| **Web UI** | Next.js (Cloud Run) | User-facing dashboard, drag-and-drop deploy, version history |
| **CLI** | Go binary (`nexus`) | Power-user interface, CI/CD integration, scriptable |
| **Scheduler** | Cloud Scheduler + Cloud Tasks | TTL enforcement, cleanup, notifications |
| **Builder** | Cloud Build | Dockerfile detection, image build, push to Artifact Registry |
| **Control DB** | Cloud SQL (Postgres) or Neon | Sandbox metadata, version history, audit log |
| **Source Store** | GCS bucket | Immutable source snapshots (tarballs) per version |
| **Image Registry** | Artifact Registry | Container images per version |
| **Slack Bot** | Slack app (Bolt framework) | Slack-native create/deploy/rollback/share |
| **MCP Server** | Lightweight HTTP server | Claude Code integration for deploy-from-conversation |

### 6.4 Build Pipeline Blueprint (Inspired by Stripe)

Like Stripe's Minions blueprints, our deploy pipeline mixes deterministic steps (predictable, no LLM) with smart steps (heuristic/AI-assisted). This keeps builds fast and reliable while handling the messiness of AI-generated code.

```
┌─────────────────────────────────────────────────────────┐
│                    Deploy Blueprint                       │
│                                                           │
│  ┏━━━━━━━━━━━━━━━┓     ┏━━━━━━━━━━━━━━━━━┓             │
│  ┃ Receive source ┃────▶┃ Snapshot to GCS  ┃  [deterministic]
│  ┗━━━━━━━━━━━━━━━┛     ┗━━━━━━━━━━━━━━━━━┛             │
│           │                                               │
│           ▼                                               │
│  ╔═══════════════════╗                                    │
│  ║ Detect runtime    ║  [smart: inspect files,            │
│  ║ + generate        ║   generate Dockerfile if missing,  │
│  ║   Dockerfile      ║   detect port, pick buildpack]     │
│  ╚═══════════════════╝                                    │
│           │                                               │
│           ▼                                               │
│  ┏━━━━━━━━━━━━━━━━━━━┓                                   │
│  ┃ Validate config    ┃  [deterministic: Dockerfile lint, │
│  ┃ (pre-build check)  ┃   port check, size check]        │
│  ┗━━━━━━━━━━━━━━━━━━━┛                                   │
│           │                                               │
│           ▼                                               │
│  ┏━━━━━━━━━━━━━━━━┓                                      │
│  ┃ Cloud Build     ┃  [deterministic]                     │
│  ┃ (build image)   ┃                                      │
│  ┗━━━━━━━━━━━━━━━━┛                                      │
│           │                                               │
│        success?                                           │
│        ╱     ╲                                            │
│      yes      no                                          │
│       │        ╲                                          │
│       │    ╔════════════════╗                              │
│       │    ║ Diagnose build ║  [smart: parse error log,   │
│       │    ║ failure + auto ║   suggest/apply fix,        │
│       │    ║ retry (1x)     ║   retry build once]         │
│       │    ╚════════════════╝                              │
│       │         │                                         │
│       ▼         ▼                                         │
│  ┏━━━━━━━━━━━━━━━━━━━━┓                                  │
│  ┃ Deploy Cloud Run    ┃  [deterministic]                 │
│  ┃ revision + traffic  ┃                                  │
│  ┏━━━━━━━━━━━━━━━━━━━━┛                                  │
│           │                                               │
│           ▼                                               │
│  ┏━━━━━━━━━━━━━━━━━━━┓                                   │
│  ┃ Health check       ┃  [deterministic: HTTP 200        │
│  ┃ (30s timeout)      ┃   on / or /health]               │
│  ┗━━━━━━━━━━━━━━━━━━━┛                                   │
│           │                                               │
│        healthy?                                           │
│        ╱     ╲                                            │
│      yes      no → auto-rollback to previous version      │
│       │                                                   │
│       ▼                                                   │
│  ┏━━━━━━━━━━━━━━━━━━━┓                                   │
│  ┃ Update DNS +       ┃  [deterministic]                  │
│  ┃ Cloudflare policy  ┃                                   │
│  ┗━━━━━━━━━━━━━━━━━━━┛                                   │
│           │                                               │
│           ▼                                               │
│       ✅ LIVE                                             │
└─────────────────────────────────────────────────────────┘

Legend: ┏━━━┓ = deterministic node   ╔═══╗ = smart node (heuristic/AI)
```

**Smart nodes are optional and bounded:** If runtime detection fails, the user is prompted to select manually. If auto-retry fails, the build stops and the user sees the error. No unbounded agent loops.

---

## 7. API Design

### 7.1 Resources

```
POST   /api/sandboxes                    → Create sandbox
GET    /api/sandboxes                    → List my sandboxes
GET    /api/sandboxes/:id                → Get sandbox details
PATCH  /api/sandboxes/:id                → Update sandbox (name, TTL, access)
DELETE /api/sandboxes/:id                → Destroy sandbox

POST   /api/sandboxes/:id/versions       → Deploy new version
GET    /api/sandboxes/:id/versions       → List versions
GET    /api/sandboxes/:id/versions/:num  → Get version details
POST   /api/sandboxes/:id/rollback       → Roll back to specified version

POST   /api/sandboxes/:id/extend         → Extend TTL
POST   /api/sandboxes/:id/share          → Update access policy

GET    /api/sandboxes/:id/logs           → Stream build/runtime logs
GET    /api/sandboxes/:id/metrics        → Basic resource usage
```

### 7.2 Authentication

- **Web UI:** SSO via Cloudflare Access (JWT in `Cf-Access-Jwt-Assertion` header)
- **CLI:** `nexus login` → OAuth2 PKCE flow against IdP → short-lived JWT
- **API:** Bearer token (JWT) validated against IdP JWKS endpoint

### 7.3 Authorization (RBAC)

| Role | Scope | Permissions |
|------|-------|-------------|
| `owner` | Per sandbox | Full CRUD, deploy, rollback, share, destroy |
| `team-member` | Per team | View, deploy (if allowed by owner) |
| `viewer` | Per sandbox | View only (access the running app) |
| `platform-admin` | Global | All operations, force-destroy, quotas, audit |

---

## 8. Versioning Deep-Dive

### 8.1 What Users See

```
┌────────────────────────────────────────────────┐
│  marketing-dashboard                           │
│  https://marketing-dashboard.nexus.app │
│                                                │
│  Versions                                      │
│  ┌──────────────────────────────────────────┐  │
│  │ ● v3  "Added date filters"    LIVE      │  │
│  │   Deployed 2h ago by Marie              │  │
│  │                                          │  │
│  │ ○ v2  "Fixed chart colors"              │  │
│  │   Deployed yesterday by Marie           │  │
│  │   [Roll back to this version]           │  │
│  │                                          │  │
│  │ ○ v1  (initial deploy)                  │  │
│  │   Deployed 3 days ago by Marie          │  │
│  │   [Roll back to this version]           │  │
│  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

### 8.2 What Happens Under the Hood

| User action | Platform action |
|-------------|-----------------|
| Upload new source | GCS snapshot + Cloud Build + new Cloud Run revision |
| "Roll back to v2" | `gcloud run services update-traffic --to-revisions=v2-rev=100` |
| "View source for v1" | Download tarball from GCS |
| Connect GitHub repo | Webhook on push → auto-create new version |

### 8.3 GitHub Integration (Progressive)

**Phase 1 — No repo required:**
- User uploads ZIP/tarball or pastes code
- Source snapshot stored in GCS
- Fully functional, but no collaboration or CI

**Phase 2 — Optional repo link:**
- User connects a GitHub repo (organization)
- Deployments can be triggered from `main` branch pushes
- Source snapshots still stored (repo is convenience, not source of truth)

**Phase 3 — Repo required (promotion):**
- Sandboxes living > 30 days get a soft prompt: "Connect a repo for durability"
- Sandboxes living > 90 days require Platform Admin approval without a repo
- Connecting a repo auto-creates an initial commit with the latest source snapshot

---

## 9. Database Management

### 9.1 Provisioning

When a user enables Postgres:
1. Platform creates a Neon project (one per sandbox)
2. Creates an initial branch (`main`)
3. Injects `DATABASE_URL` into the Cloud Run service as a secret env var
4. Sets a 1 GB storage limit (configurable by admin)

### 9.2 Migrations

Migrations are optional SQL files uploaded with a new version.

```
Deploy v3 with migration:
  1. Create Neon branch "v3" from "main"
  2. Apply migration.sql to branch "v3"
  3. Run validation:
     - Schema diff preview (shown to user before confirming)
     - Connection test from new Cloud Run revision
  4. On success:
     - Promote branch "v3" to main
     - Route traffic to new revision
  5. On failure:
     - Delete branch "v3"
     - Keep traffic on previous version
     - Show error to user
```

### 9.3 Rollback with Database

Rolling back when a DB exists:
1. Traffic shifts to previous Cloud Run revision
2. Neon branch pointer resets to previous version's branch
3. **Data written after the rolled-back version deployed may be lost** — user is warned before confirming

---

## 10. Security

### 10.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Sandbox escapes to production | Separate GCP project, no VPC peering, no shared credentials |
| Sandbox-to-sandbox lateral movement | Dedicated service accounts, no inter-service networking |
| Unauthorized access to sandbox | Cloudflare Zero Trust enforces SSO on every request |
| Malicious code in sandbox | Sandboxed Cloud Run (gVisor), no host access, egress restricted |
| Secret leakage | Secrets stored in Secret Manager, not env vars directly; rotation supported |
| Supply chain (malicious dependencies) | Egress allowlist for registries; optional vulnerability scanning on build |
| Control plane compromise | Control plane in separate project; least-privilege service accounts |

### 10.2 Cloudflare Zero Trust Setup

```
For each sandbox:
  1. Create Cloudflare Access Application
     - Name: sandbox-{name}
     - Domain: {name}.nexus.app
     - Identity provider: SSO (SAML/OIDC)
     - Policy: based on sandbox AccessPolicy (email list, group, or everyone@company.com)

  2. Create Cloudflare Tunnel (or use shared tunnel with per-service routing)
     - Route: {name}.nexus.app → Cloud Run service URL
     - Tunnel runs as a sidecar or shared connector in GCP

  3. DNS: CNAME {name}.nexus.app → tunnel endpoint
```

### 10.3 Secrets Management

- Sandbox env vars (like `DATABASE_URL`) are stored in Google Secret Manager
- Injected into Cloud Run as secret volume mounts, not plaintext env vars
- Users can add custom secrets through the UI (stored in Secret Manager, never displayed after creation)
- Secrets are scoped per sandbox and destroyed on sandbox deletion

---

## 11. Observability

### 11.1 For Sandbox Users

| Feature | Implementation |
|---------|----------------|
| Build logs | Streamed from Cloud Build, stored in GCS |
| Runtime logs | Cloud Run logs, queryable via UI (last 1000 lines, filterable) |
| Basic metrics | CPU, memory, request count — surfaced in sandbox dashboard |
| Health status | Periodic HTTP health check; status badge in UI |

### 11.2 For Platform Admins

| Feature | Implementation |
|---------|----------------|
| Global dashboard | Total sandboxes, active/sleeping/expired, cost per sandbox |
| Cost attribution | Labels on all GCP resources → BigQuery cost export → per-sandbox cost |
| Audit log | Every API call logged: who, what, when, from where |
| Alerts | Sandbox stuck in "creating" > 10 min, cost spike, cleanup failure |

---

## 12. Resource Limits & Quotas

### 12.1 Per-Sandbox Defaults

| Resource | Default | Max (admin-adjustable) |
|----------|---------|------------------------|
| Cloud Run CPU | 1 vCPU | 2 vCPU |
| Cloud Run Memory | 512 MB | 2 GB |
| Cloud Run max instances | 2 | 10 |
| Cloud Run min instances | 0 (scale to zero) | 1 |
| Neon storage | 1 GB | 10 GB |
| Source snapshot size | 100 MB | 500 MB |
| Container image size | 1 GB | 2 GB |
| Build timeout | 10 min | 30 min |

### 12.2 Per-User/Team Quotas

| Quota | Default |
|-------|---------|
| Max active sandboxes per user | 5 |
| Max active sandboxes per team | 20 |
| Max TTL without admin approval | 90 days |
| Max versions per sandbox | 50 |

---

## 13. CLI Reference

```bash
# Authentication
nexus login                          # OAuth2 browser flow
nexus whoami                         # Show current user

# Sandbox lifecycle
nexus create <name> [--from ./dir] [--from github.com/org/repo]
                             [--runtime node|python|static]
                             [--db] [--ttl 7d] [--access owner-only]
nexus list                           # List my sandboxes
nexus info <name>                    # Show sandbox details
nexus destroy <name> --confirm       # Destroy sandbox
nexus extend <name> --ttl 30d        # Extend lifetime

# Deployments
nexus deploy <name> [--from ./dir]   # Deploy new version
                             [--label "..."]
                             [--migration ./migrate.sql]
nexus rollback <name> [--to v2]      # Roll back (default: previous)
nexus versions <name>                # List versions

# Access
nexus share <name> --team            # Share with team
nexus share <name> --email a@company.com,b@company.com
nexus share <name> --everyone        # Anyone in the organization

# Debugging
nexus logs <name> [--build] [--follow]
nexus env <name>                     # Show env vars (redacted)
nexus env <name> set KEY=VALUE       # Set env var (creates new version)
```

---

## 14. Web UI Design (Intent-to-Deploy Philosophy)

The UI is designed around the DevBox.gg "intent-to-deploy" principle: every screen answers "what do you want live?" not "what infrastructure do you need?" The vocabulary is product language, not cloud language.

### 14.1 Interaction Surfaces (4 channels, one platform)

| Surface | Target User | When to Use |
|---------|-------------|-------------|
| **Web UI** | Everyone | Full control, browsing, admin |
| **Slack Bot** | Non-technical users | Quick deploys, status checks, sharing — never leave Slack |
| **CLI** | Developers | Scriptable, CI/CD integration, power-user workflows |
| **MCP Tools** | Claude Code users | Deploy from conversation, close the generate→deploy loop |

All four surfaces hit the same API. No feature is exclusive to one surface.

### 14.2 Web UI Screens

| Screen | Key Elements |
|--------|-------------|
| **Home / Dashboard** | List of my sandboxes with status badges, quick-create button, search. Hero section: "What do you want to ship?" with drag-and-drop zone for instant create. |
| **Create Sandbox** | Single-page flow (not a multi-step wizard): name → drag source → auto-detected runtime shown → optional toggles (DB, TTL, access) → "Ship it" button. Advanced options collapsed by default. |
| **Sandbox Detail** | URL (large, clickable, copyable), status pill, current version label, screenshot preview of the live app. Quick actions as icon buttons: Deploy, Share, Extend, Destroy. |
| **Versions** | Visual timeline (not a table). Each version shows: number, label, who deployed, relative time, status badge. One-click "Activate this version" button. Diff view (optional) showing source changes between versions. |
| **Deploy** | Drag-and-drop zone (large, centered), OR "Pull from GitHub" button, OR "Sync from last Claude Code session." Optional fields: label, migration SQL. Single "Deploy" button. Real-time build log stream below. |
| **Sharing** | Three big tiles: "Just me", "My team", "Anyone in the organization". Custom mode reveals email input. Copy-link button always visible. Preview of who currently has access. |
| **Settings** | Rename, transfer ownership, connect GitHub, resource limits, danger zone (destroy with type-to-confirm). |
| **Admin Panel** | Global sandbox list with filters (owner, team, age, cost). Cost dashboard with per-sandbox breakdown. Audit log with search. Quota management per user/team. Orphan detection (sandboxes with no recent activity). |

### 14.3 UX Principles

| Principle | Implementation |
|-----------|----------------|
| **One-click wherever possible** | Deploy, rollback, share, extend — all single-action with optional confirmation |
| **Progressive disclosure** | Basic flow shows 3 fields; advanced options (runtime override, resource limits, custom Dockerfile) are expandable |
| **Real-time feedback** | Build progress streams in-page, not in a separate log viewer. Status transitions animate. |
| **No jargon** | "Version" not "revision." "Ship it" not "deploy to Cloud Run." "Share" not "update access policy." |
| **Error recovery** | Build failures show a human-readable summary + "Try again" button, not raw Cloud Build logs. Auto-rollback on failed health check with clear explanation. |

---

## 15. Phased Delivery

### Phase 1 — Foundation (Weeks 1–4)

- [ ] Control plane API (CRUD sandboxes, deploy, destroy)
- [ ] Source snapshot storage (GCS)
- [ ] Cloud Build integration (Dockerfile + buildpack detection)
- [ ] Cloud Run deployment (single project, basic isolation)
- [ ] Cloudflare Zero Trust integration (access app + tunnel)
- [ ] TTL enforcement + automatic cleanup
- [ ] CLI (create, deploy, destroy, list)
- [ ] Minimal web UI (create, view, deploy)

**Exit criteria:** A user can create a sandbox from a ZIP, get a Cloudflare-protected URL, deploy a new version, and have it auto-destroyed after TTL.

### Phase 2 — Versioning & Rollback (Weeks 5–7)

- [ ] Immutable version model (snapshots, numbered versions)
- [ ] One-click rollback (traffic shift)
- [ ] Version history UI
- [ ] Build log streaming
- [ ] Basic runtime log viewer

**Exit criteria:** Users can see version history, roll back instantly, and debug build failures.

### Phase 3 — Database & Sharing (Weeks 8–10)

- [ ] Neon integration (provisioning, branching)
- [ ] Migration workflow (upload SQL, branch, apply, promote)
- [ ] Database rollback (branch switch)
- [ ] Sharing UI (team, anyone, custom emails)
- [ ] Cloudflare policy updates for sharing
- [ ] Expiry notifications (email + Slack)

**Exit criteria:** Users can provision a Postgres DB, run migrations safely, roll back with DB, and share sandboxes.

### Phase 4 — GitHub & Durability (Weeks 11–13)

- [ ] GitHub repo linking (webhook-based auto-deploy)
- [ ] Progressive repo requirement (soft prompt at 30d, hard at 90d)
- [ ] Auto-create repo from source snapshots
- [ ] Admin panel (global view, cost, audit, quotas)
- [ ] Resource limit enforcement

**Exit criteria:** Long-lived sandboxes are repo-backed and auditable. Platform admins have full visibility.

### Phase 5 — Polish & Scale (Weeks 14–16)

- [ ] Custom domains (optional, admin-managed)
- [ ] Secret management UI
- [ ] Metrics dashboard per sandbox
- [ ] Onboarding flow / guided tutorial
- [ ] Documentation site
- [ ] Load testing and hardening

---

## 16. Open Questions

| # | Question | Impact | Proposed Default |
|---|----------|--------|------------------|
| 1 | Should sandboxes support WebSocket / long-running connections? | Affects Cloud Run config (CPU always allocated) | Yes, with `--cpu-always-allocated` flag for specific sandboxes |
| 2 | Should we support multi-service sandboxes (e.g., frontend + API)? | Significantly increases complexity | No for Phase 1–4; evaluate for Phase 5+ |
| 3 | What's the cost budget for the platform? | Affects quotas and scale-to-zero aggressiveness | TBD — propose $X/sandbox/month estimate after Phase 1 |
| 4 | Should sandbox source code be visible to all team members or only to the owner? | Security/IP consideration | Owner + explicitly shared users only |
| 5 | Do we need sandbox "templates" (e.g., "Start with a Next.js dashboard")? | UX improvement for non-technical users | Phase 5 stretch goal |
| 6 | Should the platform support scheduled jobs (cron) inside sandboxes? | Requires Cloud Scheduler integration | No for now; suggest Cloud Run jobs if needed |
| 7 | What's the IdP? SAML, OIDC, Google Workspace? | Affects Cloudflare Zero Trust config | Need to confirm with security team |
| 8 | Control plane language: Go or Node.js/TypeScript? | Team skill availability | TBD — Go for performance, TS for faster iteration |

---

## 17. Success Metrics

| Metric | Target (6 months post-launch) |
|--------|-------------------------------|
| Active sandboxes | 50+ |
| Unique creators (non-eng) | 20+ |
| Median time from "create" to live URL | < 3 minutes |
| Rollback time | < 10 seconds |
| Sandbox cleanup rate (TTL enforcement) | 100% (zero orphaned resources) |
| Security incidents from sandboxes | 0 |
| Platform uptime (control plane) | 99.9% |

---

## Appendix A: Buildpack / Runtime Detection

The platform auto-detects the runtime from the uploaded source:

| Signal | Detected Runtime | Build Strategy |
|--------|-----------------|----------------|
| `Dockerfile` present | Custom | Build Dockerfile as-is |
| `package.json` + `next.config.*` | Next.js (Node) | `npm install && npm run build` → Node server |
| `package.json` (no framework) | Node.js | `npm install && npm start` |
| `requirements.txt` or `pyproject.toml` | Python | pip install → gunicorn/uvicorn |
| `index.html` (no package.json) | Static | Serve with nginx |
| `go.mod` | Go | `go build` → binary |

Users can override detection via a `sandbox.toml` in the source root:

```toml
[build]
runtime = "node"
command = "npm run build"

[run]
command = "node dist/server.js"
port = 3000

[database]
enabled = true
```

---

## Appendix B: Cost Estimate (Per Sandbox)

| Component | Monthly Cost (idle) | Monthly Cost (light use) |
|-----------|--------------------:|-------------------------:|
| Cloud Run (scale to zero) | $0.00 | ~$5–15 |
| Artifact Registry (1 image) | ~$0.10 | ~$0.10 |
| GCS (source snapshots) | ~$0.01 | ~$0.05 |
| Neon (if enabled, free tier) | $0.00 | ~$0–5 |
| Cloudflare (included in plan) | $0.00 | $0.00 |
| **Total per sandbox** | **~$0.11** | **~$5–20** |

Platform overhead (control plane, Cloud SQL, Cloud Build): ~$50–100/month fixed.
