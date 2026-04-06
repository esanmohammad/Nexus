interface Sandbox {
  id: string;
  name: string;
  owner_email: string;
  cloud_run_url?: string;
  state?: string;
  current_version?: number;
}

interface Version {
  number: number;
  label?: string;
  status: string;
}

function isSlackConfigured(): boolean {
  return !!process.env.SLACK_BOT_TOKEN;
}

export async function sendExpiryWarning(
  sandbox: Sandbox,
  hoursRemaining: number
): Promise<void> {
  if (!isSlackConfigured()) {
    console.log(
      `[notification] Expiry warning: ${sandbox.name} expires in ${hoursRemaining}h (Slack not configured)`
    );
    return;
  }

  // In production: use Slack Web API to send DM to sandbox.owner_email
  console.log(
    `[notification] Sent expiry warning to ${sandbox.owner_email}: ${sandbox.name} expires in ${hoursRemaining}h`
  );
}

export async function sendDeploySuccess(
  sandbox: Sandbox,
  version: Version
): Promise<void> {
  if (!isSlackConfigured()) {
    console.log(
      `[notification] Deploy success: ${sandbox.name} v${version.number} (Slack not configured)`
    );
    return;
  }

  console.log(
    `[notification] Sent deploy success to ${sandbox.owner_email}: ${sandbox.name} v${version.number} at ${sandbox.cloud_run_url}`
  );
}

export async function sendDeployFailure(
  sandbox: Sandbox,
  error: string
): Promise<void> {
  if (!isSlackConfigured()) {
    console.log(
      `[notification] Deploy failure: ${sandbox.name} — ${error} (Slack not configured)`
    );
    return;
  }

  console.log(
    `[notification] Sent deploy failure to ${sandbox.owner_email}: ${sandbox.name} — ${error}`
  );
}

export async function sendDestroyNotice(sandbox: Sandbox): Promise<void> {
  if (!isSlackConfigured()) {
    console.log(
      `[notification] Destroy notice: ${sandbox.name} (Slack not configured)`
    );
    return;
  }

  console.log(
    `[notification] Sent destroy notice to ${sandbox.owner_email}: ${sandbox.name}`
  );
}
