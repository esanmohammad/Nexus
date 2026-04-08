import { NexusClient } from "@nexus/sdk";

export function getClient(): NexusClient {
  const apiUrl = process.env.NEXUS_API_URL || "";
  const token = process.env.NEXUS_TOKEN || "";
  if (!apiUrl) {
    throw new Error("NEXUS_API_URL environment variable is required");
  }
  if (!token) {
    throw new Error("NEXUS_TOKEN environment variable is required");
  }
  return new NexusClient(apiUrl, token);
}

export function mcpResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export async function findSandboxByName(client: NexusClient, name: string) {
  const result = await client.listSandboxes();
  const sandboxes = (result as any).sandboxes || result;
  return (sandboxes as any[]).find((s: any) => s.name === name);
}
