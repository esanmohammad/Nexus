// Validate required environment variables
const NEXUS_API_URL = process.env.NEXUS_API_URL;
if (!NEXUS_API_URL) {
  throw new Error("NEXUS_API_URL environment variable is required");
}

const NEXUS_TOKEN = process.env.NEXUS_TOKEN;
if (!NEXUS_TOKEN) {
  throw new Error("NEXUS_TOKEN environment variable is required");
}

import { getAllTools, handlers } from "./tools/index.js";

// MCP Server setup
// In production: use @modelcontextprotocol/sdk Server + StdioServerTransport
// For now: export for testing

export const server = {
  name: "nexus",
  version: "0.1.0",
  capabilities: { tools: {} },
  tools: getAllTools(),
  handlers,
  apiUrl: NEXUS_API_URL,
  token: NEXUS_TOKEN,
};

export default server;
