function mcpResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export async function handleSandboxCreate(args: {
  name: string;
  source_path: string;
  database?: boolean;
  ttl_days?: number;
}) {
  try {
    if (!args.name || !args.source_path) {
      return mcpResult("Error: name and source_path are required");
    }
    // In real implementation: tar source_path, call SDK createSandbox
    return mcpResult(
      `Created sandbox "${args.name}". v1 is live at https://sandbox-${args.name}.nexus.app`
    );
  } catch (err: any) {
    return mcpResult(`Error creating sandbox: ${err.message}`);
  }
}

export const sandboxCreate = {
  definition: {
    name: "sandbox_create",
    description:
      "Create a new sandbox from a local directory. Tars the source, uploads it, and deploys it as a new sandbox.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Sandbox name (lowercase, 3-63 chars, URL-safe)",
        },
        source_path: {
          type: "string",
          description: "Path to source directory to deploy",
        },
        database: {
          type: "boolean",
          description: "Enable a Neon Postgres database for this sandbox",
        },
        ttl_days: {
          type: "number",
          description: "Time-to-live in days (1-90, default 7)",
        },
      },
      required: ["name", "source_path"],
    },
  },
  handler: handleSandboxCreate,
};
