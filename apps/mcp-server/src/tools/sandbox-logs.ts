function mcpResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export async function handleSandboxLogs(args: {
  name: string;
  version?: number;
}) {
  try {
    const version = args.version || "latest";
    // In real implementation: call SDK getBuildLog
    return mcpResult(`Build log for "${args.name}" v${version}:\n(no log available)`);
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
