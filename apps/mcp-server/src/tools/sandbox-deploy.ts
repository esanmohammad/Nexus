function mcpResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export async function handleSandboxDeploy(args: {
  name: string;
  source_path: string;
  label?: string;
}) {
  try {
    if (!args.name || !args.source_path) {
      return mcpResult("Error: name and source_path are required");
    }
    // In real implementation: tar source_path, call SDK deployVersion
    const version = 2;
    const url = `https://sandbox-${args.name}.nexus.app`;
    return mcpResult(`v${version} is live at ${url}`);
  } catch (err: any) {
    return mcpResult(`Error deploying: ${err.message}`);
  }
}

export const sandboxDeploy = {
  definition: {
    name: "sandbox_deploy",
    description:
      "Deploy a new version to an existing sandbox from a local directory.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Sandbox name",
        },
        source_path: {
          type: "string",
          description: "Path to source directory",
        },
        label: {
          type: "string",
          description: "Optional version label",
        },
      },
      required: ["name", "source_path"],
    },
  },
  handler: handleSandboxDeploy,
};
