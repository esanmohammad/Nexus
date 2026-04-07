import { CloudBuildClient } from "@google-cloud/cloudbuild";
import { ServicesClient, RevisionsClient } from "@google-cloud/run";
import { Storage } from "@google-cloud/storage";

let _cloudBuild: CloudBuildClient | null = null;
let _cloudBuildReady: Promise<void> | null = null;
let _cloudRunServices: ServicesClient | null = null;
let _cloudRunRevisions: RevisionsClient | null = null;
let _storage: Storage | null = null;

function getCloudBuild(): CloudBuildClient {
  if (!_cloudBuild) {
    _cloudBuild = new CloudBuildClient();
    _cloudBuildReady = _cloudBuild.initialize();
  }
  return _cloudBuild;
}

export const cloudBuild = new Proxy({} as CloudBuildClient, {
  get(_, prop) {
    const client = getCloudBuild();
    const val = (client as any)[prop];
    if (typeof val === "function") {
      return async (...args: any[]) => {
        await _cloudBuildReady;
        return val.apply(client, args);
      };
    }
    return val;
  },
});

export const cloudRunServices = new Proxy({} as ServicesClient, {
  get(_, prop) {
    if (!_cloudRunServices) _cloudRunServices = new ServicesClient();
    const client = _cloudRunServices;
    const val = (client as any)[prop];
    if (typeof val === "function") return val.bind(client);
    return val;
  },
});

export const cloudRunRevisions = new Proxy({} as RevisionsClient, {
  get(_, prop) {
    if (!_cloudRunRevisions) _cloudRunRevisions = new RevisionsClient();
    const client = _cloudRunRevisions;
    const val = (client as any)[prop];
    if (typeof val === "function") return val.bind(client);
    return val;
  },
});

export const storage = new Proxy({} as Storage, {
  get(_, prop) {
    if (!_storage) _storage = new Storage();
    const client = _storage;
    const val = (client as any)[prop];
    if (typeof val === "function") return val.bind(client);
    return val;
  },
});

export function getSnapshotsBucket() {
  const bucketName = process.env.GCS_BUCKET_SNAPSHOTS || "nexus-snapshots";
  return storage.bucket(bucketName);
}
