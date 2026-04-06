const GITHUB_API = "https://api.github.com";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_ORG = process.env.GITHUB_ORG || "org";
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "webhook-secret";

function githubHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
  };
}

export async function createRepoFromSnapshot(params: {
  repoName: string;
  sourceSnapshotUrl: string;
  description?: string;
}): Promise<{ fullName: string; repoUrl: string }> {
  const res = await fetch(`${GITHUB_API}/orgs/${GITHUB_ORG}/repos`, {
    method: "POST",
    headers: githubHeaders(),
    body: JSON.stringify({
      name: params.repoName,
      description: params.description || "",
      private: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.statusText}`);
  }

  const data = (await res.json()) as any;
  return {
    fullName: data.full_name,
    repoUrl: data.html_url,
  };
}

export async function createWebhook(
  repoFullName: string,
  sandboxId: string
): Promise<string> {
  const res = await fetch(`${GITHUB_API}/repos/${repoFullName}/hooks`, {
    method: "POST",
    headers: githubHeaders(),
    body: JSON.stringify({
      name: "web",
      active: true,
      events: ["push"],
      config: {
        url: `${process.env.API_BASE_URL || "https://api.nexus.app"}/api/webhooks/github`,
        content_type: "json",
        secret: WEBHOOK_SECRET,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.statusText}`);
  }

  const data = (await res.json()) as any;
  return String(data.id);
}

export async function deleteWebhook(
  repoFullName: string,
  webhookId: string
): Promise<void> {
  const res = await fetch(
    `${GITHUB_API}/repos/${repoFullName}/hooks/${webhookId}`,
    {
      method: "DELETE",
      headers: githubHeaders(),
    }
  );

  if (!res.ok && res.status !== 404) {
    throw new Error(`GitHub API error: ${res.statusText}`);
  }
}

export function getWebhookSecret(): string {
  return WEBHOOK_SECRET;
}
