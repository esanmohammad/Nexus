import { CloudBuildClient } from "@google-cloud/cloudbuild";
import { ServicesClient, RevisionsClient } from "@google-cloud/run";
import { Storage } from "@google-cloud/storage";

let _cloudBuild: CloudBuildClient | null = null;
let _cloudRunServices: ServicesClient | null = null;
let _cloudRunRevisions: RevisionsClient | null = null;
let _storage: Storage | null = null;

export const cloudBuild = new Proxy({} as CloudBuildClient, {
  get(_, prop) {
    if (!_cloudBuild) _cloudBuild = new CloudBuildClient();
    return (_cloudBuild as any)[prop];
  },
});

export const cloudRunServices = new Proxy({} as ServicesClient, {
  get(_, prop) {
    if (!_cloudRunServices) _cloudRunServices = new ServicesClient();
    return (_cloudRunServices as any)[prop];
  },
});

export const cloudRunRevisions = new Proxy({} as RevisionsClient, {
  get(_, prop) {
    if (!_cloudRunRevisions) _cloudRunRevisions = new RevisionsClient();
    return (_cloudRunRevisions as any)[prop];
  },
});

export const storage = new Proxy({} as Storage, {
  get(_, prop) {
    if (!_storage) _storage = new Storage();
    return (_storage as any)[prop];
  },
});

export function getSnapshotsBucket() {
  const bucketName = process.env.GCS_BUCKET_SNAPSHOTS || "nexus-snapshots";
  return storage.bucket(bucketName);
}
