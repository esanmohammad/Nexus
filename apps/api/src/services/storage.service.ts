import { getSnapshotsBucket } from "../lib/gcp.js";

const MAX_SNAPSHOT_SIZE = 100 * 1024 * 1024; // 100 MB

export async function uploadSnapshot(
  sandboxName: string,
  version: number,
  buffer: Buffer
): Promise<string> {
  if (buffer.length > MAX_SNAPSHOT_SIZE) {
    throw new Error(
      `Snapshot size (${(buffer.length / 1024 / 1024).toFixed(1)} MB) exceeds maximum allowed size of 100 MB`
    );
  }

  const bucket = getSnapshotsBucket();
  // Cloud Build accepts .zip or .tar.gz — detect by magic bytes
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  const ext = isZip ? "source.zip" : "source.tar.gz";
  const objectPath = `${sandboxName}/v${version}/${ext}`;
  const file = bucket.file(objectPath);

  await file.save(buffer, {
    contentType: isZip ? "application/zip" : "application/gzip",
    metadata: {
      sandbox: sandboxName,
      version: String(version),
      uploaded_at: new Date().toISOString(),
    },
  });

  return `gs://${bucket.name}/${objectPath}`;
}

function parseGcsUrl(gcsUrl: string): { bucket: string; object: string } {
  const match = gcsUrl.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid GCS URL: ${gcsUrl}`);
  }
  return { bucket: match[1], object: match[2] };
}

export async function downloadSnapshot(gcsUrl: string): Promise<Buffer> {
  const { object } = parseGcsUrl(gcsUrl);
  const bucket = getSnapshotsBucket();
  const file = bucket.file(object);

  const [contents] = await file.download();
  return contents;
}

export async function deleteSnapshot(gcsUrl: string): Promise<void> {
  const { object } = parseGcsUrl(gcsUrl);
  const bucket = getSnapshotsBucket();
  const file = bucket.file(object);

  try {
    await file.delete();
  } catch (err: unknown) {
    const error = err as { code?: number };
    if (error.code === 404) {
      return; // Already deleted, idempotent
    }
    throw err;
  }
}

/** Delete all GCS objects under a sandbox's prefix (all versions). */
export async function deleteAllSnapshots(sandboxName: string): Promise<void> {
  const bucket = getSnapshotsBucket();
  const prefix = `${sandboxName}/`;

  try {
    await bucket.deleteFiles({ prefix, force: true });
  } catch (err: unknown) {
    const error = err as { code?: number };
    if (error.code === 404) {
      return;
    }
    throw err;
  }
}

export async function uploadBuildLog(
  sandboxName: string,
  version: number,
  log: string
): Promise<string> {
  const bucket = getSnapshotsBucket();
  const objectPath = `${sandboxName}/v${version}/build.log`;
  const file = bucket.file(objectPath);

  await file.save(log, {
    contentType: "text/plain",
  });

  return `gs://${bucket.name}/${objectPath}`;
}
