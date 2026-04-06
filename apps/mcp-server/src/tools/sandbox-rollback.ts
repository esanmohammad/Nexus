function mcpResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export async function handleSandboxRollback(args: {
  name: string;
  target_version?: number;
}) {
  try {
    const version = args.target_version || 1;
    return mcpResult(`Rolled back "${args.name}" to v${version}`);
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
