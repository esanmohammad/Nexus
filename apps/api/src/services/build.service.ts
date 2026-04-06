import { cloudBuild } from "../lib/gcp.js";

export interface TriggerBuildParams {
  sandboxName: string;
  version: number;
  snapshotUrl: string;
  dockerfile: string;
  imageTag: string;
}

export interface BuildResult {
  buildId: string;
  success?: boolean;
  imageUrl?: string;
  error?: string;
  durationMs?: number;
}

export interface BuildStatus {
  status: "pending" | "building" | "success" | "failure" | "timeout" | "cancelled";
  imageUrl?: string;
  error?: string;
}

const STATUS_MAP: Record<string, BuildStatus["status"]> = {
  QUEUED: "pending",
  WORKING: "building",
  SUCCESS: "success",
  FAILURE: "failure",
  TIMEOUT: "timeout",
  CANCELLED: "cancelled",
  INTERNAL_ERROR: "failure",
  STATUS_UNKNOWN: "pending",
};

export async function triggerBuild(params: TriggerBuildParams): Promise<BuildResult> {
  const { sandboxName, version, snapshotUrl, dockerfile, imageTag } = params;

  // Parse GCS URL for storageSource
  const match = snapshotUrl.match(/^gs:\/\/([^/]+)\/(.+)$/);
  const bucket = match?.[1] || "";
  const object = match?.[2] || "";

  const [operation] = await cloudBuild.createBuild({
    projectId: process.env.GCP_PROJECT_ID,
    build: {
      source: {
        storageSource: { bucket, object },
      },
      steps: [
        {
          name: "gcr.io/cloud-builders/docker",
          args: ["build", "-t", imageTag, "."],
        },
      ],
      images: [imageTag],
      tags: [`sandbox-${sandboxName}`, `v${version}`],
      timeout: { seconds: 600 },
    },
  });

  const buildId =
    (operation as any).metadata?.build?.id || "unknown";

  return { buildId };
}

export async function getBuildStatus(buildId: string): Promise<BuildStatus> {
  const [build] = await cloudBuild.getBuild({
    projectId: process.env.GCP_PROJECT_ID,
    id: buildId,
  });

  const rawStatus = (build as any).status || "STATUS_UNKNOWN";
  const status = STATUS_MAP[rawStatus] || "pending";

  return {
    status,
    imageUrl: status === "success" ? (build as any).images?.[0] : undefined,
    error: status === "failure" ? (build as any).statusDetail : undefined,
  };
}

export async function getBuildLog(buildId: string): Promise<string> {
  const [build] = await cloudBuild.getBuild({
    projectId: process.env.GCP_PROJECT_ID,
    id: buildId,
  });

  return (build as any).logUrl || (build as any).logsBucket || "";
}

export interface WaitForBuildOptions {
  pollIntervalMs?: number;
  maxPolls?: number;
}

export async function waitForBuild(
  buildId: string,
  options: WaitForBuildOptions = {}
): Promise<BuildResult> {
  const { pollIntervalMs = 5000, maxPolls = 120 } = options;
  const startTime = Date.now();

  for (let i = 0; i < maxPolls; i++) {
    const status = await getBuildStatus(buildId);

    if (status.status === "success") {
      return {
        buildId,
        success: true,
        imageUrl: status.imageUrl,
        durationMs: Date.now() - startTime,
      };
    }

    if (
      status.status === "failure" ||
      status.status === "timeout" ||
      status.status === "cancelled"
    ) {
      return {
        buildId,
        success: false,
        error: status.error || `Build ${status.status}`,
        durationMs: Date.now() - startTime,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return {
    buildId,
    success: false,
    error: "Build timed out (max polls reached)",
    durationMs: Date.now() - startTime,
  };
}
