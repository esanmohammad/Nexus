import { readFileSync } from "fs";
import { resolve } from "path";

export interface RuntimeDetectionResult {
  runtime: "nodejs" | "python" | "static" | "go" | "dockerfile";
  dockerfile: string;
  port: number;
  buildCommand?: string;
  startCommand?: string;
  confidence: "high" | "medium" | "low";
}

function loadTemplate(name: string): string {
  const templatePath = resolve(
    __dirname,
    "../../../../infra/dockerfiles",
    `${name}.Dockerfile`
  );
  return readFileSync(templatePath, "utf-8");
}

function parseExposePort(dockerfile: string): number {
  const match = dockerfile.match(/EXPOSE\s+(\d+)/);
  return match ? parseInt(match[1], 10) : 8080;
}

export function detectRuntime(
  files: string[],
  fileContents: Record<string, string>
): RuntimeDetectionResult {
  // 1. Dockerfile present — use as-is
  if (files.includes("Dockerfile") && fileContents["Dockerfile"]) {
    const dockerfile = fileContents["Dockerfile"];
    return {
      runtime: "dockerfile",
      dockerfile,
      port: parseExposePort(dockerfile),
      confidence: "high",
    };
  }

  // 2. package.json detection
  if (files.includes("package.json") && fileContents["package.json"]) {
    const pkg = JSON.parse(fileContents["package.json"]);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Next.js
    if (deps.next) {
      const port = 3000;
      const template = loadTemplate("node");
      const dockerfile = generateDockerfile(template, {
        PORT: String(port),
        BUILD_COMMAND: "RUN npm run build",
        START_COMMAND: '["npm", "start"]',
      });
      return {
        runtime: "nodejs",
        dockerfile,
        port,
        buildCommand: "npm run build",
        startCommand: "npm start",
        confidence: "high",
      };
    }

    // Node.js with start script
    if (pkg.scripts?.start) {
      const port = 8080;
      const template = loadTemplate("node");
      const dockerfile = generateDockerfile(template, {
        PORT: String(port),
        BUILD_COMMAND: pkg.scripts.build ? "RUN npm run build" : "",
        START_COMMAND: '["npm", "start"]',
      });
      return {
        runtime: "nodejs",
        dockerfile,
        port,
        buildCommand: pkg.scripts.build ? "npm run build" : undefined,
        startCommand: "npm start",
        confidence: "medium",
      };
    }

    // Node.js fallback
    const port = 8080;
    const template = loadTemplate("node");
    const dockerfile = generateDockerfile(template, {
      PORT: String(port),
      BUILD_COMMAND: "",
      START_COMMAND: '["node", "index.js"]',
    });
    return {
      runtime: "nodejs",
      dockerfile,
      port,
      startCommand: "node index.js",
      confidence: "low",
    };
  }

  // 3. Python detection
  if (
    files.includes("requirements.txt") ||
    files.includes("pyproject.toml")
  ) {
    const port = 8080;
    const template = loadTemplate("python");
    const dockerfile = generateDockerfile(template, {
      PORT: String(port),
      BUILD_COMMAND: "",
      START_COMMAND: `["gunicorn", "-b", "0.0.0.0:${port}", "app:app"]`,
    });
    return {
      runtime: "python",
      dockerfile,
      port,
      startCommand: `gunicorn -b 0.0.0.0:${port} app:app`,
      confidence: "medium",
    };
  }

  // 4. Go detection
  if (files.includes("go.mod")) {
    const port = 8080;
    const template = loadTemplate("go");
    const dockerfile = generateDockerfile(template, {
      PORT: String(port),
      BUILD_COMMAND: "RUN go build -o /app/server .",
      START_COMMAND: '["/app/server"]',
    });
    return {
      runtime: "go",
      dockerfile,
      port,
      buildCommand: "go build -o /app/server .",
      startCommand: "/app/server",
      confidence: "medium",
    };
  }

  // 5. Static site detection
  if (files.includes("index.html")) {
    const port = 8080;
    const template = loadTemplate("static");
    const dockerfile = generateDockerfile(template, {
      PORT: String(port),
      BUILD_COMMAND: "",
      START_COMMAND: "",
    });
    return {
      runtime: "static",
      dockerfile,
      port,
      confidence: "medium",
    };
  }

  throw new Error(
    "Unable to detect runtime. No recognized project files found (Dockerfile, package.json, requirements.txt, pyproject.toml, go.mod, or index.html)."
  );
}

export function generateDockerfile(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  // Remove any remaining unreplaced placeholders
  result = result.replace(/\{\{.*?\}\}/g, "");
  return result;
}
