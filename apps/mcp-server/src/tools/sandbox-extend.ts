import { getClient, mcpResult, findSandboxByName } from "./client.js";

export async function handleSandboxExtend(args: {
  name: string;
  ttl_days: number;
}) {
  try {
    if (!args.name || !args.ttl_days) {
      return mcpResult("Error: name and ttl_days are required");
    }

    const client = getClient();

    const sandbox = await findSandboxByName(client, args.name);
    if (!sandbox) {
      return mcpResult(`Error: sandbox "${args.name}" not found`);
    }

    const result = await client.extendSandbox(sandbox.id, args.ttl_days);

    const expiresAt =
      result?.expires_at ||
      new Date(Date.now() + args.ttl_days * 24 * 60 * 60 * 1000).toISOString();
    return mcpResult(
      `Extended "${args.name}" by ${args.ttl_days} days. New expiry: ${expiresAt}`
    );
  } catch (err: any) {
    return mcpResult(`Error extending sandbox: ${err.message}`);
  }
}

export const sandboxExtend = {
  definition: {
    name: "sandbox_extend",
    description: "Extend the TTL (time-to-live) of a sandbox.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Sandbox name",
        },
        ttl_days: {
          type: "number",
          description: "New TTL in days (1-90)",
        },
      },
      required: ["name", "ttl_days"],
    },
  },
  handler: handleSandboxExtend,
};
