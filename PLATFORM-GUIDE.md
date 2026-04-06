# Nexus — Platform & Credentials Guide

Complete guide to every external platform, tool, and service used by Nexus. For each: what it does, how to sign up, where to find tokens/keys, and which `.env` variables to set.

---

## Table of Contents

1. [Google Cloud Platform (GCP)](#1-google-cloud-platform-gcp)
2. [Neon (Postgres)](#2-neon-postgres)
3. [GitHub](#3-github)
4. [Slack](#4-slack)
5. [Cloudflare](#5-cloudflare)
6. [Node.js & pnpm](#6-nodejs--pnpm)
7. [Docker](#7-docker)
8. [Environment Variable Reference](#8-environment-variable-reference)
9. [Cost Summary](#9-cost-summary)

---

## 1. Google Cloud Platform (GCP)

GCP provides compute (Cloud Run), container builds (Cloud Build), storage (GCS), container registry (Artifact Registry), and scheduling (Cloud Scheduler).

### 1.1 Account Setup

| Step | Action |
|------|--------|
| Sign up | https://console.cloud.google.com → "Get started for free" |
| Free tier | $300 credit for 90 days + always-free products |
| Billing | Must link a credit card, but free tier covers all Nexus testing needs |

### 1.2 Create Project

```bash
# Install gcloud CLI: https://cloud.google.com/sdk/docs/install
gcloud auth login
gcloud projects create nexus-dev --name="Nexus Dev"
gcloud config set project nexus-dev
gcloud billing accounts list  # Find your billing account ID
gcloud billing projects link nexus-dev --billing-account=YOUR_BILLING_ACCOUNT_ID
```

**Where to find:** Console → IAM & Admin → Settings → Project ID

**Env var:**
```
GCP_PROJECT_ID=nexus-dev
GCP_REGION=us-central1
```

### 1.3 Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudtasks.googleapis.com \
  secretmanager.googleapis.com
```

**Verify:** `gcloud services list --enabled`

### 1.4 Artifact Registry (Container Registry)

Stores Docker images built from sandbox source code.

```bash
gcloud artifacts repositories create sandboxes \
  --repository-format=docker \
  --location=us-central1
```

**Env var:**
```
ARTIFACT_REGISTRY=us-central1-docker.pkg.dev/nexus-dev/sandboxes
```

**Where to find:** Console → Artifact Registry → Repositories

### 1.5 Cloud Storage (GCS) — Snapshot Bucket

Stores source code tarballs and build logs.

```bash
gcloud storage buckets create gs://nexus-snapshots \
  --location=us-central1
```

**Env var:**
```
GCS_BUCKET_SNAPSHOTS=nexus-snapshots
```

**Where to find:** Console → Cloud Storage → Buckets

### 1.6 IAM — Cloud Build Permissions

Cloud Build needs permission to push images to Artifact Registry and deploy to Cloud Run.

```bash
PROJECT_NUMBER=$(gcloud projects describe nexus-dev --format='value(projectNumber)')

# Permission to push container images
gcloud projects add-iam-policy-binding nexus-dev \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Permission to deploy to Cloud Run
gcloud projects add-iam-policy-binding nexus-dev \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

# Permission for Cloud Build SA to act as compute SA (needed for Cloud Run deploy)
gcloud iam service-accounts add-iam-policy-binding \
  ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

**Verify:** `gcloud projects get-iam-policy nexus-dev`

### 1.7 Google OAuth 2.0 (Authentication)

Used for user login during testing phase.

| Step | Action |
|------|--------|
| Go to | https://console.cloud.google.com/apis/credentials |
| Click | "Create Credentials" → "OAuth client ID" |
| Type | Web application |
| Name | "Nexus Dev" |
| Authorized redirect URIs | `http://localhost:8080/api/auth/callback` (dev) and `https://YOUR_CLOUD_RUN_URL/api/auth/callback` (prod) |
| Copy | Client ID and Client Secret |

**Before creating OAuth client:**
1. Go to https://console.cloud.google.com/apis/credentials/consent
2. Configure OAuth consent screen: "Internal" (if Workspace) or "External"
3. App name: "Nexus", add your email as test user

**Env vars:**
```
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
```

**Where to find:** Console → APIs & Services → Credentials → OAuth 2.0 Client IDs → Click your client → Client ID and Client Secret shown on the right panel

### 1.8 Service Account Key (Local Development)

For local development, you need a service account key to authenticate GCP API calls.

```bash
# Create service account
gcloud iam service-accounts create nexus-dev-sa \
  --display-name="Nexus Dev Service Account"

# Grant roles
gcloud projects add-iam-policy-binding nexus-dev \
  --member="serviceAccount:nexus-dev-sa@nexus-dev.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding nexus-dev \
  --member="serviceAccount:nexus-dev-sa@nexus-dev.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding nexus-dev \
  --member="serviceAccount:nexus-dev-sa@nexus-dev.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding nexus-dev \
  --member="serviceAccount:nexus-dev-sa@nexus-dev.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Download key (KEEP SECRET — never commit this file)
gcloud iam service-accounts keys create ./nexus-sa-key.json \
  --iam-account=nexus-dev-sa@nexus-dev.iam.gserviceaccount.com
```

**Usage (local only):**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=./nexus-sa-key.json
```

**On Cloud Run:** No key needed — Cloud Run uses the default compute service account automatically.

### 1.9 Cloud Scheduler

Used for automated TTL cleanup (every 15 minutes).

```bash
# Create after API is deployed to Cloud Run
gcloud scheduler jobs create http cleanup-cycle \
  --schedule="*/15 * * * *" \
  --uri="https://YOUR_API_CLOUD_RUN_URL/api/internal/cleanup" \
  --http-method=POST \
  --oidc-service-account-email=nexus-dev-sa@nexus-dev.iam.gserviceaccount.com \
  --location=us-central1
```

**Where to find:** Console → Cloud Scheduler → Jobs

### 1.10 GCP Free Tier Limits (Relevant to Nexus)

| Service | Free Tier | Nexus Usage |
|---------|-----------|-------------|
| Cloud Run | 2M requests/month, 360K vCPU-sec, 180K GiB-sec | Control plane + sandboxes |
| Cloud Build | 120 build-min/day | Sandbox builds |
| Artifact Registry | 500 MB storage | Container images |
| Cloud Storage | 5 GB, 5K Class A ops, 50K Class B ops | Source snapshots |
| Cloud Scheduler | 3 jobs free | 1 cleanup job |

---

## 2. Neon (Postgres)

Neon provides serverless Postgres for both the control plane database and optional per-sandbox databases.

### 2.1 Account Setup

| Step | Action |
|------|--------|
| Sign up | https://neon.tech → "Sign Up" (GitHub or email) |
| Free tier | 1 project, 0.5 GiB storage, 190 compute hours/month |
| Plan | Free tier is sufficient for development |

### 2.2 Create Control Plane Database

| Step | Action |
|------|--------|
| Go to | https://console.neon.tech |
| Click | "New Project" |
| Name | `nexus-control-plane` |
| Region | `US East (Ohio)` or closest to `us-central1` |
| Database | `control_plane` (created automatically) |

**Where to find the connection string:**
1. Dashboard → Your project → "Connection Details" panel (right side)
2. Select: Role = `neondb_owner`, Database = `control_plane`
3. Toggle "Pooled connection" ON for production, OFF for migrations
4. Copy the full connection string

**Env var:**
```
DATABASE_URL=postgresql://neondb_owner:PASSWORD@ep-xxxx-xxxx.us-east-2.aws.neon.tech/control_plane?sslmode=require
```

### 2.3 Get Neon API Key

The API key is needed to programmatically create sandbox databases (Wave 6).

| Step | Action |
|------|--------|
| Go to | https://console.neon.tech/app/settings/api-keys |
| Click | "Create new API Key" |
| Name | `nexus-dev` |
| Copy | The API key (shown only once) |

**Env var:**
```
NEON_API_KEY=napi_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**API Base URL:** `https://console.neon.tech/api/v2`

**API Docs:** https://api-docs.neon.tech/reference/getting-started-with-neon-api

### 2.4 Neon Free Tier Limits

| Resource | Limit |
|----------|-------|
| Projects | 1 (use branching for sandbox DBs) |
| Storage | 0.5 GiB |
| Compute | 190 hours/month |
| Branches | 10 per project |
| Roles | 4 per project |

**Note:** For Wave 6 (sandbox databases), each sandbox with DB uses a Neon branch. Free tier allows 10 branches — enough for testing.

---

## 3. GitHub

GitHub is used for CI/CD (Actions), optional repo integration (Wave 7), and webhook-triggered auto-deploys.

### 3.1 Account Setup

| Step | Action |
|------|--------|
| Sign up | https://github.com (free account is sufficient) |
| Create org | Optional — for team repos, go to https://github.com/organizations/new |

### 3.2 Personal Access Token (for API access)

Used by the GitHub service (Wave 7) to create repos and manage webhooks.

| Step | Action |
|------|--------|
| Go to | https://github.com/settings/tokens?type=beta (Fine-grained tokens) |
| Click | "Generate new token" |
| Name | `nexus-dev` |
| Expiration | 90 days (or custom) |
| Repository access | "All repositories" or specific repos |
| Permissions | Repository: `Administration: Read and write`, `Contents: Read and write`, `Webhooks: Read and write` |
| Generate | Copy the token (shown only once) |

**Env var:**
```
GITHUB_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxx
```

**Alternative: GitHub App (recommended for production)**

| Step | Action |
|------|--------|
| Go to | https://github.com/settings/apps/new |
| Name | "Nexus Platform" |
| Webhook URL | `https://YOUR_API_URL/api/webhooks/github` |
| Permissions | Repository: Contents (read), Webhooks (read/write), Administration (read/write) |
| Events | Push |
| Generate private key | Download `.pem` file |

### 3.3 Webhook Secret

When creating webhooks (Wave 7), Nexus generates a shared secret to verify incoming webhook payloads.

**Env var:**
```
GITHUB_WEBHOOK_SECRET=your-random-webhook-secret
```

**Generate a random secret:**
```bash
openssl rand -hex 32
```

### 3.4 GitHub Actions (CI)

No additional tokens needed — GitHub Actions uses the built-in `GITHUB_TOKEN` automatically for your repository.

**Setup:** Push `.github/workflows/ci.yml` to your repo. Actions will run on push/PR to main.

**Where to see:** Your repo → Actions tab

---

## 4. Slack

Slack is used for the bot interface (Wave 5) and notifications.

### 4.1 Create Slack App

| Step | Action |
|------|--------|
| Go to | https://api.slack.com/apps |
| Click | "Create New App" → "From scratch" |
| App Name | `Nexus` |
| Workspace | Select your workspace |

### 4.2 Configure Bot Token Scopes

| Step | Action |
|------|--------|
| Go to | Your app → "OAuth & Permissions" |
| Scroll to | "Scopes" → "Bot Token Scopes" |
| Add these scopes | `app_mentions:read`, `chat:write`, `files:read`, `im:write`, `im:history` |

### 4.3 Enable Event Subscriptions

| Step | Action |
|------|--------|
| Go to | Your app → "Event Subscriptions" |
| Toggle | "Enable Events" → ON |
| Subscribe to bot events | `app_mention`, `message.im` |

**Note:** For Socket Mode (development), you don't need a Request URL. For HTTP mode (production), set the URL to `https://YOUR_API_URL/api/slack/events`.

### 4.4 Enable Socket Mode

| Step | Action |
|------|--------|
| Go to | Your app → "Socket Mode" |
| Toggle | "Enable Socket Mode" → ON |
| Name the token | `nexus-socket` |
| Copy | App-Level Token (starts with `xapp-`) |

**Env var:**
```
SLACK_APP_TOKEN=xapp-1-xxxxxxxxxxxxxxxx
```

### 4.5 Enable Interactive Components

| Step | Action |
|------|--------|
| Go to | Your app → "Interactivity & Shortcuts" |
| Toggle | "Interactivity" → ON |
| Request URL | `https://YOUR_API_URL/api/slack/interactions` (not needed for Socket Mode) |

### 4.6 Install App to Workspace

| Step | Action |
|------|--------|
| Go to | Your app → "Install App" |
| Click | "Install to Workspace" |
| Authorize | Review permissions and allow |
| Copy | "Bot User OAuth Token" (starts with `xoxb-`) |

**Env var:**
```
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx
```

### 4.7 Get Signing Secret

| Step | Action |
|------|--------|
| Go to | Your app → "Basic Information" |
| Scroll to | "App Credentials" |
| Copy | "Signing Secret" |

**Env var:**
```
SLACK_SIGNING_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4.8 Token Summary

| Token | Where to Find | Starts With | Env Var |
|-------|--------------|-------------|---------|
| Bot Token | OAuth & Permissions → Bot User OAuth Token | `xoxb-` | `SLACK_BOT_TOKEN` |
| Signing Secret | Basic Information → App Credentials | (hex string) | `SLACK_SIGNING_SECRET` |
| App Token | Basic Information → App-Level Tokens | `xapp-` | `SLACK_APP_TOKEN` |

### 4.9 Test the Bot

1. Go to your Slack workspace
2. Open any channel
3. Type `/invite @Nexus` to add the bot
4. Type `@Nexus status test` — bot should respond

---

## 5. Cloudflare

Cloudflare provides Zero Trust access control, DNS, and tunneling. **Deferred to Wave 9** — not needed for testing.

### 5.1 Account Setup

| Step | Action |
|------|--------|
| Sign up | https://dash.cloudflare.com/sign-up |
| Free plan | Sufficient for testing, includes Zero Trust for up to 50 users |

### 5.2 Add Domain

| Step | Action |
|------|--------|
| Go to | https://dash.cloudflare.com → "Add a Site" |
| Enter | Your domain (e.g., `nexus.app`) |
| Plan | Free |
| Update nameservers | Point your domain registrar's nameservers to Cloudflare's (shown after adding) |
| Wait | DNS propagation (usually 5-30 minutes) |

### 5.3 Create API Token

| Step | Action |
|------|--------|
| Go to | https://dash.cloudflare.com/profile/api-tokens |
| Click | "Create Token" |
| Template | "Custom token" |
| Name | `nexus-platform` |
| Permissions | Zone → DNS → Edit; Account → Access: Apps and Policies → Edit; Account → Cloudflare Tunnel → Edit |
| Zone Resources | Include → Specific zone → your domain |
| Create | Copy the token (shown only once) |

**Env vars:**
```
CLOUDFLARE_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLOUDFLARE_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Where to find Account ID:** Dashboard → any domain → right sidebar → "Account ID"

### 5.4 Create Cloudflare Tunnel

```bash
# Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel login  # Opens browser for auth
cloudflared tunnel create nexus-tunnel
cloudflared tunnel route dns nexus-tunnel "*.nexus.app"
```

**Env var:**
```
CLOUDFLARE_TUNNEL_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**Where to find:** Dashboard → Zero Trust → Networks → Tunnels

### 5.5 Zero Trust Access Setup

| Step | Action |
|------|--------|
| Go to | https://one.dash.cloudflare.com → Access → Applications |
| The API creates apps programmatically | But you can also create manually for testing |
| Authentication | Configure identity provider (Google, GitHub, etc.) under Settings → Authentication |

### 5.6 Cloudflare Free Tier Limits

| Feature | Free Tier |
|---------|-----------|
| Zero Trust users | 50 |
| Tunnels | Unlimited |
| DNS records | Unlimited |
| Access Applications | Unlimited |

---

## 6. Node.js & pnpm

### 6.1 Node.js 22 LTS

| Platform | Install |
|----------|---------|
| macOS | `brew install node@22` or https://nodejs.org/en/download |
| Ubuntu | `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo -E bash - && sudo apt-get install -y nodejs` |
| Any | Use `nvm`: `nvm install 22 && nvm use 22` |

**Verify:** `node --version` → should show `v22.x.x`

### 6.2 pnpm 9+

```bash
# Enable via corepack (included with Node.js 22)
corepack enable
corepack prepare pnpm@9.15.0 --activate

# Or install directly
npm install -g pnpm@9
```

**Verify:** `pnpm --version` → should show `9.x.x`

---

## 7. Docker

Docker is needed for building and testing container images locally.

### 7.1 Install Docker

| Platform | Install |
|----------|---------|
| macOS | https://docs.docker.com/desktop/install/mac-install/ (Docker Desktop) |
| Linux | https://docs.docker.com/engine/install/ |

**Verify:** `docker --version` and `docker run hello-world`

### 7.2 Authenticate with Artifact Registry

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

This allows `docker push` to Artifact Registry.

---

## 8. Environment Variable Reference

Complete `.env` file with every variable, grouped by service and wave.

```bash
# ═══════════════════════════════════════════════════════════════
# GCP — Required from Wave 0
# ═══════════════════════════════════════════════════════════════
GCP_PROJECT_ID=nexus-dev
GCP_REGION=us-central1
GCS_BUCKET_SNAPSHOTS=nexus-snapshots
ARTIFACT_REGISTRY=us-central1-docker.pkg.dev/nexus-dev/sandboxes

# ═══════════════════════════════════════════════════════════════
# Neon — Required from Wave 0 (control plane DB)
# ═══════════════════════════════════════════════════════════════
DATABASE_URL=postgresql://neondb_owner:PASSWORD@ep-xxxx.us-east-2.aws.neon.tech/control_plane?sslmode=require

# ═══════════════════════════════════════════════════════════════
# Auth — Required from Wave 1
# ═══════════════════════════════════════════════════════════════
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
JWT_SECRET=generate-a-random-256-bit-string
SESSION_SECRET=generate-another-random-256-bit-string

# Generate secrets:
#   openssl rand -base64 32

# ═══════════════════════════════════════════════════════════════
# Neon API — Required from Wave 6 (sandbox databases)
# ═══════════════════════════════════════════════════════════════
NEON_API_KEY=napi_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ═══════════════════════════════════════════════════════════════
# GitHub — Required from Wave 7
# ═══════════════════════════════════════════════════════════════
GITHUB_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxx
GITHUB_WEBHOOK_SECRET=your-random-webhook-secret

# ═══════════════════════════════════════════════════════════════
# Slack — Required from Wave 5
# ═══════════════════════════════════════════════════════════════
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx
SLACK_SIGNING_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SLACK_APP_TOKEN=xapp-1-xxxxxxxxxxxxxxxx

# ═══════════════════════════════════════════════════════════════
# Cloudflare — Required from Wave 9 (deferred)
# ═══════════════════════════════════════════════════════════════
# CLOUDFLARE_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# CLOUDFLARE_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# CLOUDFLARE_TUNNEL_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# ═══════════════════════════════════════════════════════════════
# Admin — Required from Wave 8
# ═══════════════════════════════════════════════════════════════
ADMIN_EMAILS=admin@yourcompany.com,admin2@yourcompany.com

# ═══════════════════════════════════════════════════════════════
# App Config
# ═══════════════════════════════════════════════════════════════
PORT=8080
NODE_ENV=development
```

### When Each Variable Is Needed

| Variable | First Used | Required For |
|----------|-----------|--------------|
| `GCP_PROJECT_ID` | Wave 0 | All GCP operations |
| `GCP_REGION` | Wave 0 | Cloud Run, GCS, Artifact Registry |
| `GCS_BUCKET_SNAPSHOTS` | Wave 1 | Source code storage |
| `ARTIFACT_REGISTRY` | Wave 1 | Container image storage |
| `DATABASE_URL` | Wave 0 | Control plane database |
| `GOOGLE_CLIENT_ID` | Wave 1 | User authentication |
| `GOOGLE_CLIENT_SECRET` | Wave 1 | User authentication |
| `JWT_SECRET` | Wave 1 | Session token signing |
| `SESSION_SECRET` | Wave 1 | Cookie signing |
| `SLACK_BOT_TOKEN` | Wave 5 | Slack bot |
| `SLACK_SIGNING_SECRET` | Wave 5 | Slack request verification |
| `SLACK_APP_TOKEN` | Wave 5 | Slack Socket Mode |
| `NEON_API_KEY` | Wave 6 | Sandbox database provisioning |
| `GITHUB_TOKEN` | Wave 7 | Repo creation, webhook management |
| `GITHUB_WEBHOOK_SECRET` | Wave 7 | Webhook signature verification |
| `ADMIN_EMAILS` | Wave 8 | Admin panel access |
| `CLOUDFLARE_API_TOKEN` | Wave 9 | Zero Trust access control |
| `CLOUDFLARE_ACCOUNT_ID` | Wave 9 | Cloudflare API calls |
| `CLOUDFLARE_TUNNEL_ID` | Wave 9 | Traffic routing |

---

## 9. Cost Summary

### Testing Phase ($0/month)

| Service | Plan | Cost |
|---------|------|------|
| GCP (Cloud Run, Build, GCS, AR, Scheduler) | Free tier | $0 |
| Neon | Free tier | $0 |
| GitHub | Free | $0 |
| Slack | Free workspace | $0 |
| Cloudflare | Deferred | $0 |
| Node.js, pnpm, Docker | Open source | $0 |
| **Total** | | **$0/month** |

### Production Phase (Estimated)

| Service | Plan | Estimated Cost |
|---------|------|---------------|
| GCP Cloud Run | Beyond free tier | $5-50/month |
| GCP Cloud Build | Beyond 120 min/day | $0-10/month |
| Neon | Pro (more branches/storage) | $19/month |
| Cloudflare | Free (up to 50 users) | $0 |
| Custom domain | Annual renewal | $10-15/year |
| **Total** | | **$25-80/month** |

---

## Quick Start Checklist

```
□ Node.js 22 installed
□ pnpm 9 installed
□ Docker installed
□ gcloud CLI installed and authenticated
□ GCP project created (nexus-dev)
□ GCP APIs enabled (6 APIs)
□ Artifact Registry repo created (sandboxes)
□ GCS bucket created (nexus-snapshots)
□ Cloud Build IAM configured
□ Service account key downloaded (local dev only)
□ Neon account created
□ Neon control plane project + database created
□ Neon connection string copied to DATABASE_URL
□ Google OAuth client created
□ OAuth client ID + secret copied
□ JWT_SECRET and SESSION_SECRET generated
□ .env file created from .env.example
□ All Wave 0 env vars populated
```

Once all boxes are checked, run:

```bash
cd nexus
pnpm install
pnpm build
pnpm --filter @nexus/api dev
# Open http://localhost:8080/api/health → { "status": "ok" }
```
