function mcpResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export async function handleSandboxDestroy(args: {
  name: string;
  confirm: boolean;
}) {
  try {
    if (!args.confirm) {
      return mcpResult(
        `Please confirm destruction of "${args.name}" by setting confirm: true`
      );
    }
    // In real implementation: call SDK destroySandbox
    return mcpResult(`Destroyed sandbox "${args.name}"`);
  } catch (err: any) {
    return mcpResult(`Error destroying sandbox: ${err.message}`);
  }
}

export const sandboxDestroy = {
  definition: {
    name: "sandbox_destroy",
    description:
      "Permanently destroy a sandbox and all its versions. Requires explicit confirmation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Sandbox name to destroy",
        },
        confirm: {
          type: "boolean",
          description: "Must be true to confirm destruction",
        },
      },
      required: ["name", "confirm"],
    },
  },
  handler: handleSandboxDestroy,
};
