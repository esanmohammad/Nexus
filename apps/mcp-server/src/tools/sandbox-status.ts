function mcpResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export async function handleSandboxStatus(args: { name: string }) {
  try {
    if (!args.name) {
      return mcpResult("Error: name is required");
    }
    // In real implementation: call SDK getSandbox
    return mcpResult(
      `Sandbox: ${args.name}\nState: unknown\nNote: Could not fetch status (sandbox may not exist)`
    );
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
