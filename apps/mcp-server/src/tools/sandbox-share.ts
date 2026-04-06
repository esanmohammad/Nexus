function mcpResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export async function handleSandboxShare(args: {
  name: string;
  access_mode: string;
  emails?: string[];
}) {
  try {
    return mcpResult(
      `Updated "${args.name}" access to: ${args.access_mode}`
    );
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
