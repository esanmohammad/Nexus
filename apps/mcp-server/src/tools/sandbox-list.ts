import { getClient, mcpResult } from "./client.js";

export async function handleSandboxList(_args: Record<string, unknown>) {
  try {
    const client = getClient();
    const result = await client.listSandboxes();
    const sandboxes = (result as any).sandboxes || result;

    if (!Array.isArray(sandboxes) || sandboxes.length === 0) {
      return mcpResult("No sandboxes found.");
    }

    const header = `Found ${sandboxes.length} sandbox(es):\n`;
    const rows = sandboxes.map((s: any) => {
      const parts = [
        `  ${s.name}`,
        `state=${s.state || s.status || "?"}`,
      ];
      if (s.version !== undefined) parts.push(`v${s.version}`);
      if (s.url) parts.push(s.url);
      if (s.expires_at) parts.push(`expires=${s.expires_at}`);
      return parts.join("  ");
    });

    return mcpResult(header + rows.join("\n"));
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
