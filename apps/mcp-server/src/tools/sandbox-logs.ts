import { getClient, mcpResult, findSandboxByName } from "./client.js";

export async function handleSandboxLogs(args: {
  name: string;
  version?: number;
}) {
  try {
    if (!args.name) {
      return mcpResult("Error: name is required");
    }

    const client = getClient();

    const sandbox = await findSandboxByName(client, args.name);
    if (!sandbox) {
      return mcpResult(`Error: sandbox "${args.name}" not found`);
    }

    // Use provided version or fall back to current version
    const version = args.version ?? sandbox.version ?? 1;

    const log = await client.getBuildLog(sandbox.id, version);

    if (!log || log.trim().length === 0) {
      return mcpResult(
        `Build log for "${args.name}" v${version}:\n(empty log)`
      );
    }

    return mcpResult(`Build log for "${args.name}" v${version}:\n${log}`);
  } catch (err: any) {
    return mcpResult(`Error fetching logs: ${err.message}`);
  }
}

export const sandboxLogs = {
  definition: {
    name: "sandbox_logs",
    description: "Get the build log for a sandbox version.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Sandbox name",
        },
        version: {
          type: "number",
          description: "Version number (default: latest)",
        },
      },
      required: ["name"],
    },
  },
  handler: handleSandboxLogs,
};
