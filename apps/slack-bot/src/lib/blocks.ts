interface Sandbox {
  id: string;
  name: string;
  cloud_run_url?: string;
  state: string;
  current_version?: number;
}

interface Version {
  number: number;
  label?: string;
  status: string;
}

export function buildDeploySuccessMessage(sandbox: Sandbox, version: Version) {
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*v${version.number} is live!* :rocket:\n<${sandbox.cloud_run_url}|${sandbox.name}>`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Sandbox:* ${sandbox.name}` },
          { type: "mrkdwn", text: `*Version:* v${version.number}` },
          { type: "mrkdwn", text: `*Label:* ${version.label || "—"}` },
          { type: "mrkdwn", text: `*Status:* ${version.status}` },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open" },
            url: sandbox.cloud_run_url,
            action_id: "open_sandbox",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Rollback" },
            action_id: "rollback_confirm",
            value: sandbox.id,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Share" },
            action_id: "share_dialog",
            value: sandbox.id,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Extend" },
            action_id: "extend_quick",
            value: sandbox.id,
          },
        ],
      },
    ],
  };
}

export function buildDeployFailureMessage(sandbox: Sandbox, error: string) {
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Deploy failed for ${sandbox.name}* :x:\n\`\`\`${error}\`\`\``,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Retry" },
            action_id: "deploy_retry",
            value: sandbox.id,
          },
        ],
      },
    ],
  };
}

export function buildStatusMessage(sandbox: Sandbox, versions: Version[]) {
  const versionLines = versions
    .slice(0, 5)
    .map(
      (v) =>
        `v${v.number} ${v.label || ""} — ${v.status}`
    )
    .join("\n");

  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${sandbox.name}*\nState: ${sandbox.state}\nURL: ${sandbox.cloud_run_url || "—"}\nCurrent version: v${sandbox.current_version || 1}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Versions:*\n${versionLines || "No versions"}`,
        },
      },
    ],
  };
}

export function buildExpiryWarningMessage(
  sandbox: Sandbox,
  hoursRemaining: number
) {
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${sandbox.name}* expires in ${hoursRemaining} hours :warning:\nExtend it to keep it alive.`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "extend 7 days" },
            action_id: "extend_quick",
            value: sandbox.id,
            style: "primary",
          },
        ],
      },
    ],
  };
}

export function buildDestroyNoticeMessage(sandbox: Sandbox) {
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${sandbox.name}* has been destroyed :wastebasket:\nAll versions and data have been permanently removed.`,
        },
      },
    ],
  };
}
