# Prerequisites — Environment Setup

All prerequisites must be completed before starting Wave 0.

---

## PRE-001: Create GCP Project

**Depends on:** None
**Effort:** 15 min

### Steps
1. Go to console.cloud.google.com
2. Create project with ID `nexus-dev`
3. Link a billing account (free tier is sufficient)

### Acceptance Criteria
- [ ] `gcloud projects describe nexus-dev` returns project info
- [ ] Billing account linked (even if on free tier)

---

## PRE-002: Enable GCP APIs

**Depends on:** PRE-001
**Effort:** 5 min

### Steps
```bash
gcloud config set project nexus-dev
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudtasks.googleapis.com \
  secretmanager.googleapis.com
```

### Acceptance Criteria
- [ ] `gcloud services list --enabled --project=nexus-dev` includes all 6 APIs
- [ ] No error returned from the enable command

---

## PRE-003: Create Artifact Registry Repository

**Depends on:** PRE-002
**Effort:** 5 min

### Steps
```bash
gcloud artifacts repositories create sandboxes \
  --repository-format=docker \
  --location=us-central1 \
  --project=nexus-dev
```

### Acceptance Criteria
- [ ] `gcloud artifacts repositories describe sandboxes --location=us-central1` returns repo info
- [ ] Repository format is `DOCKER`
- [ ] Location is `us-central1`

---

## PRE-004: Create GCS Bucket for Snapshots

**Depends on:** PRE-002
**Effort:** 5 min

### Steps
```bash
gcloud storage buckets create gs://nexus-snapshots \
  --location=us-central1 \
  --project=nexus-dev
```

### Acceptance Criteria
- [ ] `gcloud storage buckets describe gs://nexus-snapshots` returns bucket info
- [ ] Bucket location is `us-central1`

---

## PRE-005: Configure IAM for Cloud Build

**Depends on:** PRE-003
**Effort:** 5 min

### Steps
```bash
PROJECT_NUMBER=$(gcloud projects describe nexus-dev --format='value(projectNumber)')
SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding nexus-dev \
  --member="serviceAccount:${SA}" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding nexus-dev \
  --member="serviceAccount:${SA}" \
  --role="roles/run.admin"
```

### Acceptance Criteria
- [ ] Cloud Build SA has `roles/artifactregistry.writer` on project
- [ ] Cloud Build SA has `roles/run.admin` on project
- [ ] `gcloud projects get-iam-policy nexus-dev` shows both bindings

---

## PRE-006: Create Neon Account and Control Plane Database

**Depends on:** None
**Effort:** 10 min

### Steps
1. Sign up at neon.tech (free tier)
2. Create a project named `nexus-control-plane`
3. Create a database named `control_plane`
4. Copy the connection string

### Acceptance Criteria
- [ ] Neon project `nexus-control-plane` exists
- [ ] Database `control_plane` exists within the project
- [ ] Connection string (`postgresql://...@...neon.tech/control_plane`) is available
- [ ] Can connect to the database using `psql` or any Postgres client
- [ ] Neon API key generated (Settings → API Keys)
