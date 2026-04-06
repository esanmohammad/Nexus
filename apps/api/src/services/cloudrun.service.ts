import { cloudRunServices } from "../lib/gcp.js";

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "";
const GCP_REGION = process.env.GCP_REGION || "us-central1";

function servicePath(sandboxName: string) {
  return `projects/${GCP_PROJECT_ID}/locations/${GCP_REGION}/services/sandbox-${sandboxName}`;
}

export interface CreateServiceParams {
  sandboxName: string;
  imageUrl: string;
  port: number;
  envVars?: Record<string, string>;
  ownerEmail?: string;
  version?: number;
  sandboxId?: string;
}

export interface CreateServiceResult {
  serviceUrl: string;
  revisionName: string;
}

export async function createService(
  params: CreateServiceParams
): Promise<CreateServiceResult> {
  const { sandboxName, imageUrl, port, envVars = {}, ownerEmail, version = 1, sandboxId } = params;

  const envArray = [
    { name: "SANDBOX_NAME", value: sandboxName },
    { name: "SANDBOX_ID", value: sandboxId || sandboxName },
    { name: "VERSION", value: String(version) },
    { name: "PORT", value: String(port) },
    ...Object.entries(envVars).map(([name, value]) => ({ name, value })),
  ];

  const [response] = await cloudRunServices.createService({
    parent: `projects/${GCP_PROJECT_ID}/locations/${GCP_REGION}`,
    serviceId: `sandbox-${sandboxName}`,
    service: {
      labels: {
        sandbox: sandboxName,
        owner: ownerEmail?.replace(/[^a-z0-9_-]/gi, "_") || "unknown",
        version: `v${version}`,
      },
      template: {
        containers: [
          {
            image: imageUrl,
            ports: [{ containerPort: port }],
            env: envArray,
            resources: {
              limits: {
                cpu: "1",
                memory: "512Mi",
              },
            },
          },
        ],
        scaling: {
          minInstanceCount: 0,
          maxInstanceCount: 2,
        },
      },
    },
  });

  return {
    serviceUrl:
      (response as any).status?.url ||
      (response as any).uri ||
      `https://sandbox-${sandboxName}-abc123-uc.a.run.app`,
    revisionName:
      (response as any).latestCreatedRevisionName ||
      `sandbox-${sandboxName}-00001`,
  };
}

export interface DeployRevisionParams {
  sandboxName: string;
  imageUrl: string;
  port: number;
  envVars?: Record<string, string>;
  version?: number;
}

export interface DeployRevisionResult {
  revisionName: string;
}

export async function deployRevision(
  params: DeployRevisionParams
): Promise<DeployRevisionResult> {
  const { sandboxName, imageUrl, port, envVars = {}, version } = params;

  const envArray = [
    { name: "SANDBOX_NAME", value: sandboxName },
    { name: "PORT", value: String(port) },
    ...(version ? [{ name: "VERSION", value: String(version) }] : []),
    ...Object.entries(envVars).map(([name, value]) => ({ name, value })),
  ];

  const [response] = await cloudRunServices.updateService({
    service: {
      name: servicePath(sandboxName),
      template: {
        containers: [
          {
            image: imageUrl,
            ports: [{ containerPort: port }],
            env: envArray,
          },
        ],
      },
    },
  });

  return {
    revisionName:
      (response as any).latestCreatedRevisionName ||
      `sandbox-${sandboxName}-00002`,
  };
}

export interface ShiftTrafficParams {
  sandboxName: string;
  revisionName: string;
}

export async function shiftTraffic(
  params: ShiftTrafficParams
): Promise<void> {
  const { sandboxName, revisionName } = params;

  await cloudRunServices.updateService({
    service: {
      name: servicePath(sandboxName),
      traffic: [
        {
          type: "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION",
          revision: revisionName,
          percent: 100,
        },
      ],
    },
  });
}

export async function deleteService(sandboxName: string): Promise<void> {
  try {
    await cloudRunServices.deleteService({
      name: servicePath(sandboxName),
    });
  } catch (err: unknown) {
    const error = err as { code?: number };
    if (error.code === 404 || error.code === 5) {
      return; // Already deleted, idempotent
    }
    throw err;
  }
}

export async function getServiceUrl(
  sandboxName: string
): Promise<string | null> {
  try {
    const [service] = await cloudRunServices.getService({
      name: servicePath(sandboxName),
    });
    return (service as any).status?.url || (service as any).uri || null;
  } catch (err: unknown) {
    const error = err as { code?: number };
    if (error.code === 404 || error.code === 5) {
      return null;
    }
    throw err;
  }
}
