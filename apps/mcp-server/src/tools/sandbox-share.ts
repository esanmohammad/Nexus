import { getClient, mcpResult, findSandboxByName } from "./client.js";

export async function handleSandboxShare(args: {
  name: string;
  access_mode: string;
  emails?: string[];
}) {
  try {
    if (!args.name || !args.access_mode) {
      return mcpResult("Error: name and access_mode are required");
    }

    const client = getClient();

    const sandbox = await findSandboxByName(client, args.name);
    if (!sandbox) {
      return mcpResult(`Error: sandbox "${args.name}" not found`);
    }

    const input: Record<string, unknown> = {
      access_mode: args.access_mode,
    };
    if (args.emails) {
      input.allowed_emails = args.emails;
    }

    await client.shareSandbox(sandbox.id, input);

    let msg = `Updated "${args.name}" access to: ${args.access_mode}`;
    if (args.emails && args.emails.length > 0) {
      msg += `\nAllowed emails: ${args.emails.join(", ")}`;
    }
    return mcpResult(msg);
  } catch (err: any) {
    return mcpResult(`Error sharing: ${err.message}`);
  }
}

export const sandboxShare = {
  definition: {
    name: "sandbox_share",
    description:
      "Update the access policy for a sandbox. Set who can view it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Sandbox name",
        },
        access_mode: {
          type: "string",
          description: "Access mode: owner_only, team, anyone, or custom",
          enum: ["owner_only", "team", "anyone", "custom"],
        },
        emails: {
          type: "array",
          items: { type: "string" },
          description: "Email addresses for custom access mode",
        },
      },
      required: ["name", "access_mode"],
    },
  },
  handler: handleSandboxShare,
};
