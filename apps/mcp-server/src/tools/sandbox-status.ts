import { getClient, mcpResult, findSandboxByName } from "./client.js";

export async function handleSandboxStatus(args: { name: string }) {
  try {
    if (!args.name) {
      return mcpResult("Error: name is required");
    }

    const client = getClient();

    const sandbox = await findSandboxByName(client, args.name);
    if (!sandbox) {
      return mcpResult(`Error: sandbox "${args.name}" not found`);
    }

    const details = await client.getSandbox(sandbox.id);

    const lines: string[] = [
      `Sandbox: ${details.name}`,
      `ID: ${details.id}`,
      `State: ${details.state || details.status || "unknown"}`,
    ];
    if (details.url) lines.push(`URL: ${details.url}`);
    if (details.version !== undefined)
      lines.push(`Current Version: v${details.version}`);
    if (details.runtime) lines.push(`Runtime: ${details.runtime}`);
    if (details.database) lines.push(`Database: enabled`);
    if (details.expires_at)
      lines.push(`Expires: ${details.expires_at}`);
    if (details.created_at)
      lines.push(`Created: ${details.created_at}`);
    if (details.access_mode)
      lines.push(`Access: ${details.access_mode}`);

    return mcpResult(lines.join("\n"));
  } catch (err: any) {
    return mcpResult(`Error fetching status: ${err.message}`);
  }
}

export const sandboxStatus = {
  definition: {
    name: "sandbox_status",
    description: "Get the current status and details of a sandbox.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Sandbox name",
        },
      },
      required: ["name"],
    },
  },
  handler: handleSandboxStatus,
};
