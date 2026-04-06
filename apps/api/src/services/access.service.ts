const CF_API = "https://api.cloudflare.com/client/v4";
const CF_TOKEN = () => process.env.CLOUDFLARE_API_TOKEN || "";
const CF_ACCOUNT_ID = () => process.env.CLOUDFLARE_ACCOUNT_ID || "";
const DOMAIN = "nexus.app";

function cfHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${CF_TOKEN()}`,
  };
}

function buildPolicies(accessMode: string, allowedEmails?: string[]) {
  switch (accessMode) {
    case "owner_only":
      return { include: [{ email: { email: allowedEmails?.[0] } }] };
    case "team":
      return {
        include: [
          {
            email_domain: {
              domain: allowedEmails?.[0]?.split("@")[1],
            },
          },
        ],
      };
    case "anyone":
      return { include: [{ everyone: {} }] };
    case "custom":
      return {
        include: (allowedEmails || []).map((e) => ({ email: { email: e } })),
      };
    default:
      return {};
  }
}

export async function createAccessApp(params: {
  sandboxName: string;
  cloudRunUrl: string;
  accessMode: string;
  allowedEmails?: string[];
}): Promise<{ accessAppId: string; hostname: string }> {
  const hostname = `${params.sandboxName}.${DOMAIN}`;
  const policies = buildPolicies(params.accessMode, params.allowedEmails);

  const res = await fetch(
    `${CF_API}/accounts/${CF_ACCOUNT_ID()}/access/apps`,
    {
      method: "POST",
      headers: cfHeaders(),
      body: JSON.stringify({
        name: `sandbox-${params.sandboxName}`,
        domain: hostname,
        type: "self_hosted",
        session_duration: "24h",
        policies,
        ...((params.allowedEmails && params.allowedEmails.length > 0)
          ? { allowed_emails: params.allowedEmails }
          : {}),
      }),
    }
  );

  const data = (await res.json()) as any;
  return {
    accessAppId: data.result.id,
    hostname,
  };
}

export async function updateAccessPolicy(
  accessAppId: string,
  params: { accessMode: string; allowedEmails?: string[] }
): Promise<void> {
  const policies = buildPolicies(params.accessMode, params.allowedEmails);

  await fetch(
    `${CF_API}/accounts/${CF_ACCOUNT_ID()}/access/apps/${accessAppId}/policies`,
    {
      method: "PUT",
      headers: cfHeaders(),
      body: JSON.stringify({
        ...policies,
        ...(params.allowedEmails
          ? { allowed_emails: params.allowedEmails }
          : {}),
      }),
    }
  );
}

export async function deleteAccessApp(accessAppId: string): Promise<void> {
  const res = await fetch(
    `${CF_API}/accounts/${CF_ACCOUNT_ID()}/access/apps/${accessAppId}`,
    {
      method: "DELETE",
      headers: cfHeaders(),
    }
  );

  if (!res.ok && res.status !== 404) {
    throw new Error(`Cloudflare API error: ${res.statusText}`);
  }
}
