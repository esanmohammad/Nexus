import { cloudRunServices } from "../lib/gcp.js";

function getProjectId() { return process.env.GCP_PROJECT_ID || ""; }
function getRegion() { return process.env.GCP_REGION || "us-central1"; }

function servicePath(sandboxName: string) {
  return `projects/${getProjectId()}/locations/${getRegion()}/services/sandbox-${sandboxName}`;
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
    ...Object.entries(envVars).map(([name, value]) => ({ name, value })),
  ];

  // createService returns an LRO — wait for it to complete
  const [operation] = await cloudRunServices.createService({
    parent: `projects/${getProjectId()}/locations/${getRegion()}`,
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

  // Wait for the LRO to finish
  const [service] = await (operation as any).promise();

  const serviceUrl =
    service?.uri ||
    service?.status?.url ||
    `https://sandbox-${sandboxName}-${getProjectId()}.${getRegion()}.run.app`;

  // Make the service publicly accessible
  try {
    await cloudRunServices.setIamPolicy({
      resource: servicePath(sandboxName),
      policy: {
        bindings: [
          {
            role: "roles/run.invoker",
            members: ["allUsers"],
          },
        ],
      },
    });
  } catch (err) {
    console.error("Failed to set public access:", err);
  }

  return {
    serviceUrl,
    revisionName:
      service?.latestCreatedRevisionName ||
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
    ...(version ? [{ name: "VERSION", value: String(version) }] : []),
    ...Object.entries(envVars).map(([name, value]) => ({ name, value })),
  ];

  const [operation] = await cloudRunServices.updateService({
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

  const [service] = await (operation as any).promise();

  return {
    revisionName:
      service?.latestCreatedRevisionName ||
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

  const [operation] = await cloudRunServices.updateService({
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

  await (operation as any).promise();
}

export async function deleteService(sandboxName: string): Promise<void> {
  try {
    const [operation] = await cloudRunServices.deleteService({
      name: servicePath(sandboxName),
    });
    await (operation as any).promise();
  } catch (err: unknown) {
    const error = err as { code?: number };
    if (error.code === 404 || error.code === 5) {
      return;
    }
    throw err;
  }
}

/** Delete all Artifact Registry images for a sandbox (all version tags). */
export async function deleteArtifactImage(sandboxName: string): Promise<void> {
  const registry = process.env.ARTIFACT_REGISTRY;
  if (!registry) return;

  // registry format: us-central1-docker.pkg.dev/project/repo
  // We need to delete the package: us-central1-docker.pkg.dev/project/repo/sandboxName
  const imagePath = `${registry}/${sandboxName}`;

  // Parse: LOCATION-docker.pkg.dev/PROJECT/REPOSITORY/PACKAGE
  const match = imagePath.match(
    /^([a-z0-9-]+)-docker\.pkg\.dev\/([^/]+)\/([^/]+)\/(.+)$/
  );
  if (!match) {
    console.warn(`[destroy] Could not parse AR image path: ${imagePath}`);
    return;
  }
  const [, location, project, repo, pkg] = match;

  // Use REST API — no extra SDK needed
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();

  const url = `https://artifactregistry.googleapis.com/v1/projects/${project}/locations/${location}/repositories/${repo}/packages/${encodeURIComponent(pkg)}`;

  try {
    await client.request({ url, method: "DELETE" });
  } catch (err: unknown) {
    const error = err as { code?: number; status?: number; response?: { status?: number } };
    const status = error.code || error.status || error.response?.status;
    if (status === 404) return; // Already gone
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
    return (service as any).uri || (service as any).status?.url || null;
  } catch (err: unknown) {
    const error = err as { code?: number };
    if (error.code === 404 || error.code === 5) {
      return null;
    }
    throw err;
  }
}
