import { getClient, mcpResult, findSandboxByName } from "./client.js";

export async function handleSandboxRollback(args: {
  name: string;
  target_version?: number;
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

    const result = await client.rollback(sandbox.id, args.target_version);

    const version =
      result?.version || result?.active_version || args.target_version || "previous";
    return mcpResult(
      `Rolled back "${args.name}" to v${version}`
    );
  } catch (err: any) {
    return mcpResult(`Error rolling back: ${err.message}`);
  }
}

export const sandboxRollback = {
  definition: {
    name: "sandbox_rollback",
    description: "Roll back a sandbox to a previous version.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Sandbox name",
        },
        target_version: {
          type: "number",
          description: "Version number to roll back to (default: previous)",
        },
      },
      required: ["name"],
    },
  },
  handler: handleSandboxRollback,
};
