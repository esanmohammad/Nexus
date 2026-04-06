function mcpResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export async function handleSandboxList(_args: Record<string, unknown>) {
  try {
    // In real implementation: call SDK listSandboxes
    return mcpResult("No sandboxes found.");
  } catch (err: any) {
    return mcpResult(`Error listing sandboxes: ${err.message}`);
  }
}

export const sandboxList = {
  definition: {
    name: "sandbox_list",
    description: "List all sandboxes owned by the current user.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  handler: handleSandboxList,
};
