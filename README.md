<p align="center">
  <img src="https://img.shields.io/badge/Nexus-Sandbox%20Platform-6366f1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0yMCA3bC04LTQtOCA0bTE2IDBsLTggNG04LTR2MTBsLTggNG0wLTEwTDQgN204IDR2MTBNNCA3djEwbDggNCIvPjwvc3ZnPg==" alt="Nexus" />
</p>

<h1 align="center">Nexus</h1>

<p align="center">
  <strong>ZIP to live sandbox in seconds.</strong><br/>
  Nexus turns your code into isolated, shareable sandboxes with versioning, rollback, and team collaboration — no infra required.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="#mcp-integration">MCP Integration</a> &bull;
  <a href="#web-dashboard">Dashboard</a> &bull;
  <a href="#architecture">Architecture</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node" />
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/GCP-Cloud%20Run-4285F4" alt="GCP" />
  <img src="https://img.shields.io/badge/Neon-Postgres-00e599" alt="Neon" />
</p>

---

## What is Nexus?

Nexus is an internal platform that lets you deploy any codebase as an isolated sandbox. Upload a ZIP, paste a GitHub link, or use the MCP tool from Claude Code — Nexus handles runtime detection, Docker builds, Cloud Run deployment, and Postgres provisioning automatically.

```
You: Upload a ZIP or paste a GitHub repo URL

Nexus:
  1. Detects runtime (Node.js, Python, Go, static HTML)
  2. Generates Dockerfile if missing
  3. Builds container image via Cloud Build
  4. Deploys to Cloud Run with unique URL
  5. Provisions Neon Postgres branch (optional)

Result: https://sandbox-my-app-abc123.run.app  (live in ~60s)
```

**Every sandbox gets:** version history, one-click rollback, team sharing, TTL auto-cleanup, and a live URL.

---

## Quick Start

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9
- **GCP project** with Cloud Build, Cloud Run, and Artifact Registry enabled
- **Neon account** (optional, for database-enabled sandboxes)

### Install & Run

```bash
git clone https://github.com/esanmohammad/Nexus.git
cd Nexus
pnpm install

# Copy env template and fill in your GCP/Neon credentials
cp .env.example .env

# Start API + Web in one command
pnpm dev
```

Open `http://localhost:3000` and click **Login** to set the dev session.

---

## How It Works

### Deploy Flow

1. **Upload** — ZIP file, tarball, or GitHub repo URL
2. **Detect** — Runtime auto-detection from `package.json`, `requirements.txt`, `go.mod`, `Dockerfile`
3. **Build** — Cloud Build creates a container image, pushes to Artifact Registry
4. **Deploy** — Cloud Run serves the sandbox with a unique HTTPS URL
5. **Version** — Each deploy creates a versioned snapshot with full rollback support

### Sandbox Lifecycle

```
Creating  →  Running  →  Sleeping  →  Destroyed
                ↑            │
                └── wake ────┘
                     (24h extension)
```

- **Running** — Live on Cloud Run, accessible via URL
- **Sleeping** — TTL expired, Cloud Run scaled to zero, snapshots preserved
- **Destroyed** — 7 days after sleeping, all resources cleaned up
- **Notifications** — 72h and 24h warnings before expiry

### Version Management

Every deploy creates a version record with:
- Source snapshot in GCS
- Container image in Artifact Registry
- Cloud Run revision for instant rollback
- Optional Neon Postgres branch for database migrations

---

## MCP Integration

Nexus ships with a Model Context Protocol (MCP) server that lets Claude Code deploy sandboxes directly.

### Setup

```bash
claude mcp add nexus-mcp --transport stdio \
  -e NEXUS_API_URL=http://localhost:8080 \
  -e NEXUS_TOKEN=your-token \
  --scope user -- node /path/to/Nexus/apps/mcp-server/dist/index.js
```

### Available Tools

| Tool | Description |
|------|-------------|
| `sandbox_create` | Create a sandbox or deploy new version if it exists. Accepts `source_path` or `github_url`. Name auto-derived from repo. |
| `sandbox_deploy` | Deploy a new version to an existing sandbox |
| `sandbox_status` | Get sandbox details (state, URL, version, expiry) |
| `sandbox_list` | List all your sandboxes |
| `sandbox_rollback` | Roll back to a previous version |
| `sandbox_share` | Update access policy (owner, team, public) |
| `sandbox_logs` | Get build logs for a version |
| `sandbox_extend` | Extend sandbox TTL |
| `sandbox_destroy` | Permanently destroy a sandbox |

### Smart Create-or-Deploy

The `sandbox_create` tool automatically detects if a sandbox exists:

```
# First time — creates "my-app" sandbox
sandbox_create(github_url: "https://github.com/user/my-app")
→ Created sandbox "my-app" from GitHub. v1 is live.

# Second time — deploys v2 to existing sandbox
sandbox_create(github_url: "https://github.com/user/my-app")
→ Sandbox "my-app" already exists — deployed new version. v2 is live.
```

---

## Web Dashboard

The web UI provides full sandbox management with a dark glassmorphism theme.

### Features

- **Dashboard** — Search, filter by status (running/sleeping/failed), sandbox count summary
- **Create Sandbox** — Upload ZIP or paste GitHub URL, configure TTL/database/access mode
- **Sandbox Detail** — Live URL, version timeline with rollback, extend TTL, share, destroy
- **Deploy** — Upload new version with confirmation step and build progress
- **Build Logs** — Real-time build output with step-by-step progress
- **Toast Notifications** — Success/error/undo feedback for all actions

### UI Highlights

- Step progress indicator (Configure → Building → Live)
- Segmented TTL picker (1d / 7d / 14d / 30d / 60d / 90d / Custom)
- Color-coded sandbox cards by state
- Keyboard-accessible filter chips and controls
- Animated expand/collapse for advanced options and danger zone

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER LAYER                           │
│                                                             │
│  Web UI (Next.js)    MCP Server     Slack Bot    CLI        │
│  localhost:3000      (stdio)        (Bolt SDK)   (planned)  │
└──────────┬───────────────┬──────────────┬───────────────────┘
           │               │              │
           ▼               ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                     CONTROL PLANE                           │
│                                                             │
│  API Server (Hono + TypeScript)     localhost:8080          │
│  Auth (Google OAuth + JWT + dev tokens)                     │
│  Control DB (Neon Postgres via Drizzle ORM)                 │
│  Cleanup Scheduler (Cloud Scheduler, every 15min)           │
└──────────┬──────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                   BUILD & DEPLOY LAYER                      │
│                                                             │
│  Cloud Build → Artifact Registry → Cloud Run                │
│  GCS (source snapshots)    Neon (Postgres branches)         │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Component | Technology |
|-----------|-----------|
| API Server | TypeScript, Hono, Node.js |
| Web UI | Next.js 15, React, Tailwind CSS v4 |
| Database | Neon Postgres, Drizzle ORM |
| Build | Google Cloud Build |
| Runtime | Google Cloud Run |
| Storage | Google Cloud Storage |
| Images | Google Artifact Registry |
| MCP Server | @modelcontextprotocol/sdk |
| SDK | TypeScript client (`@nexus/sdk`) |
| Monorepo | pnpm workspaces, Turborepo |

### Project Structure

```
apps/
  api/              # Hono API server (routes, services, middleware)
  web/              # Next.js 15 web dashboard
  mcp-server/       # MCP server for Claude Code integration
  slack-bot/        # Slack bot (Bolt SDK)
packages/
  db/               # Drizzle ORM schema + Neon client
  sdk/              # TypeScript SDK (NexusClient)
  shared/           # Zod schemas, types, enums
scripts/
  gcp-cleanup.sh    # Clean all GCP resources
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sandboxes` | Create sandbox (multipart or JSON with `github_url`) |
| `GET` | `/api/sandboxes` | List all sandboxes |
| `GET` | `/api/sandboxes/:id` | Get sandbox details |
| `DELETE` | `/api/sandboxes/:id` | Destroy sandbox |
| `POST` | `/api/sandboxes/:id/versions` | Deploy new version |
| `GET` | `/api/sandboxes/:id/versions` | List version history |
| `POST` | `/api/sandboxes/:id/rollback` | Rollback to previous version |
| `POST` | `/api/sandboxes/:id/extend` | Extend TTL |
| `POST` | `/api/sandboxes/:id/share` | Update access policy |
| `POST` | `/api/sandboxes/:id/connect-repo` | Connect GitHub repo for webhooks |

---

## Environment Variables

Create a `.env` file from `.env.example`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon Postgres connection string |
| `JWT_SECRET` | Secret for signing auth tokens |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to GCP service account key |
| `ARTIFACT_REGISTRY` | GCP Artifact Registry path |
| `GCS_BUCKET_SNAPSHOTS` | GCS bucket for source snapshots |
| `NEON_API_KEY` | Neon API key for database provisioning |
| `GITHUB_TOKEN` | GitHub token for repo access |
| `GITHUB_WEBHOOK_SECRET` | Secret for GitHub webhook verification |

---

## License

[MIT License](LICENSE)

---

<p align="center">
  Built by <a href="https://github.com/esanmohammad">Esan Mohammad</a><br/>
  <sub>Nexus — ship anything, instantly.</sub>
</p>
