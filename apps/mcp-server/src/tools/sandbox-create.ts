import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { getClient, mcpResult, findSandboxByName } from "./client.js";

/** Extract a sandbox-friendly name from a GitHub URL: github.com/user/my-repo → my-repo */
function nameFromGithubUrl(url: string): string {
  const cleaned = url.replace(/\.git$/, "").replace(/\/$/, "");
  const parts = cleaned.split("/");
  const repo = parts[parts.length - 1] || "sandbox";
  // Ensure it's lowercase and valid
  return repo.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
}

export async function handleSandboxCreate(args: {
  name?: string;
  source_path?: string;
  github_url?: string;
  database?: boolean;
  ttl_days?: number;
  label?: string;
}) {
  try {
    if (!args.source_path && !args.github_url) {
      return mcpResult("Error: either source_path or github_url is required");
    }

    // Derive name from github_url if not provided
    const name = args.name || (args.github_url ? nameFromGithubUrl(args.github_url) : null);
    if (!name) {
      return mcpResult("Error: name is required (or provide github_url to auto-derive it)");
    }

    const client = getClient();

    // Check if sandbox already exists → deploy new version instead
    const existing = await findSandboxByName(client, name);
    if (existing) {
      // Deploy new version to existing sandbox
      let source: Blob;
      const deployConfig: Record<string, unknown> = {};

      if (args.github_url) {
        const emptyBuf = Buffer.alloc(0);
        source = new Blob([emptyBuf], { type: "application/gzip" });
        deployConfig.github_url = args.github_url;
      } else {
        const sourcePath = path.resolve(args.source_path!);
        if (!fs.existsSync(sourcePath)) {
          return mcpResult(`Error: source_path does not exist: ${sourcePath}`);
        }
        const tmpTar = path.join(os.tmpdir(), `nexus-deploy-${Date.now()}.tar.gz`);
        execSync(`tar czf "${tmpTar}" -C "${sourcePath}" .`, { stdio: "pipe" });
        const tarBuffer = fs.readFileSync(tmpTar);
        source = new Blob([tarBuffer], { type: "application/gzip" });
        fs.unlinkSync(tmpTar);
      }

      const label = args.label || (args.github_url ? `deploy from ${args.github_url}` : undefined);
      const result = await client.deployVersion(existing.id, source, label, deployConfig);

      const version = result?.current_version || result?.number || (existing.current_version || 1) + 1;
      const url = existing.cloud_run_url || `Deploying...`;
      return mcpResult(
        `Sandbox "${name}" already exists — deployed new version.\n` +
        `Version: v${version}\n` +
        `URL: ${url}\n` +
        `State: ${existing.state}`
      );
    }

    // Create new sandbox
    const config: Record<string, unknown> = { name };
    if (args.database) config.database = true;
    if (args.ttl_days) config.ttl_days = args.ttl_days;

    if (args.github_url) {
      config.github_url = args.github_url;
      const emptyBuf = Buffer.alloc(0);
      const source = new Blob([emptyBuf], { type: "application/gzip" });
      const result = await client.createSandbox(config, source);
      const url = result?.cloud_run_url || `Deploying...`;
      return mcpResult(
        `Created sandbox "${name}" from ${args.github_url}\n` +
        `ID: ${result?.id}\n` +
        `URL: ${url}\n` +
        `Version: v1\n` +
        `State: ${result?.state || "creating"}`
      );
    }

    // Tar the source directory
    const sourcePath = path.resolve(args.source_path!);
    if (!fs.existsSync(sourcePath)) {
      return mcpResult(`Error: source_path does not exist: ${sourcePath}`);
    }

    const tmpTar = path.join(os.tmpdir(), `nexus-source-${Date.now()}.tar.gz`);
    try {
      execSync(`tar czf "${tmpTar}" -C "${sourcePath}" .`, { stdio: "pipe" });
      const tarBuffer = fs.readFileSync(tmpTar);
      const source = new Blob([tarBuffer], { type: "application/gzip" });
      const result = await client.createSandbox(config, source);

      const url = result?.cloud_run_url || `Deploying...`;
      return mcpResult(
        `Created sandbox "${name}"\n` +
        `ID: ${result?.id}\n` +
        `URL: ${url}\n` +
        `Version: v1\n` +
        `State: ${result?.state || "creating"}`
      );
    } finally {
      if (fs.existsSync(tmpTar)) fs.unlinkSync(tmpTar);
    }
  } catch (err: any) {
    return mcpResult(`Error creating sandbox: ${err.message}`);
  }
}

export const sandboxCreate = {
  definition: {
    name: "sandbox_create",
    description:
      "Create a new sandbox or deploy a new version if it already exists. Accepts a local directory or GitHub URL. If name is omitted, it is derived from the GitHub repo name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description:
            "Sandbox name (lowercase, 3-63 chars, URL-safe). If omitted, derived from github_url repo name.",
        },
        source_path: {
          type: "string",
          description:
            "Path to source directory to deploy (provide this or github_url)",
        },
        github_url: {
          type: "string",
          description:
            "GitHub repository URL to deploy from (alternative to source_path). Name auto-derived from repo name if not provided.",
        },
        database: {
          type: "boolean",
          description: "Enable a Neon Postgres database for this sandbox",
        },
        ttl_days: {
          type: "number",
          description: "Time-to-live in days (1-90, default 7)",
        },
        label: {
          type: "string",
          description: "Optional version label for the deployment",
        },
      },
      required: [],
    },
  },
  handler: handleSandboxCreate,
};
