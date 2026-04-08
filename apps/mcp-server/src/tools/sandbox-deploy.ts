import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { getClient, mcpResult, findSandboxByName } from "./client.js";

export async function handleSandboxDeploy(args: {
  name: string;
  source_path?: string;
  github_url?: string;
  label?: string;
}) {
  try {
    if (!args.name) {
      return mcpResult("Error: name is required");
    }
    if (!args.source_path && !args.github_url) {
      return mcpResult("Error: either source_path or github_url is required");
    }

    const client = getClient();

    const sandbox = await findSandboxByName(client, args.name);
    if (!sandbox) {
      return mcpResult(`Error: sandbox "${args.name}" not found`);
    }

    if (args.github_url) {
      const emptyBuf = Buffer.alloc(0);
      const source = new Blob([emptyBuf], { type: "application/gzip" });
      const result = await client.deployVersion(
        sandbox.id,
        source,
        args.label || `deploy from ${args.github_url}`,
        { github_url: args.github_url }
      );
      const version = result?.version || result?.version_number;
      const url = sandbox.url || `https://sandbox-${args.name}.nexus.app`;
      return mcpResult(
        `Deployed v${version} to "${args.name}" from ${args.github_url}\nURL: ${url}`
      );
    }

    // Tar the source directory
    const sourcePath = path.resolve(args.source_path!);
    if (!fs.existsSync(sourcePath)) {
      return mcpResult(`Error: source_path does not exist: ${sourcePath}`);
    }

    const tmpTar = path.join(os.tmpdir(), `nexus-deploy-${Date.now()}.tar.gz`);
    try {
      execSync(`tar czf "${tmpTar}" -C "${sourcePath}" .`, {
        stdio: "pipe",
      });

      const tarBuffer = fs.readFileSync(tmpTar);
      const source = new Blob([tarBuffer], { type: "application/gzip" });
      const result = await client.deployVersion(
        sandbox.id,
        source,
        args.label
      );

      const version = result?.version || result?.version_number;
      const url = sandbox.url || `https://sandbox-${args.name}.nexus.app`;
      return mcpResult(`v${version} is live at ${url}`);
    } finally {
      if (fs.existsSync(tmpTar)) {
        fs.unlinkSync(tmpTar);
      }
    }
  } catch (err: any) {
    return mcpResult(`Error deploying: ${err.message}`);
  }
}

export const sandboxDeploy = {
  definition: {
    name: "sandbox_deploy",
    description:
      "Deploy a new version to an existing sandbox from a local directory or GitHub URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Sandbox name",
        },
        source_path: {
          type: "string",
          description:
            "Path to source directory (provide this or github_url)",
        },
        github_url: {
          type: "string",
          description:
            "GitHub repository URL to deploy from (alternative to source_path)",
        },
        label: {
          type: "string",
          description: "Optional version label",
        },
      },
      required: ["name"],
    },
  },
  handler: handleSandboxDeploy,
};
