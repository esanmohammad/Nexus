#!/bin/bash
# GCP Cleanup Script — deletes all Cloud Run services, Artifact Registry images, and GCS snapshots
# Usage: ./scripts/gcp-cleanup.sh

PROJECT="nexus-platform-dev"
REGION="us-central1"
REPO="us-central1-docker.pkg.dev/$PROJECT/sandboxes"
BUCKET="nexus-snapshots-dev"

echo "=== Cloud Run Services ==="
SERVICES=$(gcloud run services list --project=$PROJECT --region=$REGION --format="value(name)" 2>/dev/null)
if [ -z "$SERVICES" ]; then
  echo "  (none)"
else
  for svc in $SERVICES; do
    echo "  Deleting $svc..."
    gcloud run services delete "$svc" --project=$PROJECT --region=$REGION --quiet 2>&1
  done
fi

echo ""
echo "=== Artifact Registry Images ==="
IMAGES=$(gcloud artifacts docker images list "$REPO" --format="value(PACKAGE)" 2>/dev/null | sort -u)
if [ -z "$IMAGES" ]; then
  echo "  (none)"
else
  for img in $IMAGES; do
    echo "  Deleting $img..."
    gcloud artifacts docker images delete "$img" --project=$PROJECT --quiet --delete-tags 2>&1
  done
fi

echo ""
echo "=== GCS Snapshots ==="
OBJECTS=$(gsutil ls "gs://$BUCKET/" 2>/dev/null)
if [ -z "$OBJECTS" ]; then
  echo "  (none)"
else
  echo "  Deleting all objects in gs://$BUCKET/..."
  gsutil -m rm -r "gs://$BUCKET/**" 2>&1
fi

echo ""
echo "Done. All GCP resources cleaned up."
