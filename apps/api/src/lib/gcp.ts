import { CloudBuildClient } from "@google-cloud/cloudbuild";
import { ServicesClient, RevisionsClient } from "@google-cloud/run";
import { Storage } from "@google-cloud/storage";

export const cloudBuild = new CloudBuildClient();
export const cloudRunServices = new ServicesClient();
export const cloudRunRevisions = new RevisionsClient();
export const storage = new Storage();

export function getSnapshotsBucket() {
  const bucketName = process.env.GCS_BUCKET_SNAPSHOTS || "nexus-snapshots";
  return storage.bucket(bucketName);
}
