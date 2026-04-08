import { getClient, mcpResult, findSandboxByName } from "./client.js";

export async function handleSandboxDestroy(args: {
  name: string;
  confirm: boolean;
}) {
  try {
    if (!args.name) {
      return mcpResult("Error: name is required");
    }
    if (!args.confirm) {
      return mcpResult(
        `Please confirm destruction of "${args.name}" by setting confirm: true`
      );
    }

    const client = getClient();

    const sandbox = await findSandboxByName(client, args.name);
    if (!sandbox) {
      return mcpResult(`Error: sandbox "${args.name}" not found`);
    }

    await client.destroySandbox(sandbox.id);

    return mcpResult(`Destroyed sandbox "${args.name}"`);
  } catch (err: any) {
    return mcpResult(`Error destroying sandbox: ${err.message}`);
  }
}

export const sandboxDestroy = {
  definition: {
    name: "sandbox_destroy",
    description:
      "Permanently destroy a sandbox and all its versions. Requires explicit confirmation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Sandbox name to destroy",
        },
        confirm: {
          type: "boolean",
          description: "Must be true to confirm destruction",
        },
      },
      required: ["name", "confirm"],
    },
  },
  handler: handleSandboxDestroy,
};
