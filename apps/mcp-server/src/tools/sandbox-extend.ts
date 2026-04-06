function mcpResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export async function handleSandboxExtend(args: {
  name: string;
  ttl_days: number;
}) {
  try {
    const expiresAt = new Date(
      Date.now() + args.ttl_days * 24 * 60 * 60 * 1000
    );
    // In real implementation: call SDK extendSandbox
    return mcpResult(
      `Extended "${args.name}" by ${args.ttl_days} days. New expiry: ${expiresAt.toISOString()}`
    );
  } catch (err: any) {
    return mcpResult(`Error extending sandbox: ${err.message}`);
  }
}

export const sandboxExtend = {
  definition: {
    name: "sandbox_extend",
    description: "Extend the TTL (time-to-live) of a sandbox.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Sandbox name",
        },
        ttl_days: {
          type: "number",
          description: "New TTL in days (1-90)",
        },
      },
      required: ["name", "ttl_days"],
    },
  },
  handler: handleSandboxExtend,
};
