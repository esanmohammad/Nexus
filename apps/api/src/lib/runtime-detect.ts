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
  // 1. Dockerfile present — use as-is, unless it's incompatible with the project
  if (files.includes("Dockerfile") && fileContents["Dockerfile"]) {
    const dockerfile = fileContents["Dockerfile"];
    // Check if Dockerfile uses npm but project requires pnpm (workspace: protocol)
    const needsPnpm = files.includes("pnpm-lock.yaml") || files.includes("pnpm-workspace.yaml");
    const dockerfileUsesNpm = /npm (ci|install)/.test(dockerfile) && !/pnpm/.test(dockerfile);
    if (!(needsPnpm && dockerfileUsesNpm)) {
      return {
        runtime: "dockerfile",
        dockerfile,
        port: parseExposePort(dockerfile),
        confidence: "high",
      };
    }
    // Fall through to auto-detection if Dockerfile is incompatible
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

    // Vite / CRA / static SPA — build produces static files, serve with nginx
    const hasVite = deps.vite || files.some((f) => /^(vite\.config\.(ts|js|mjs)|apps\/[^/]+\/vite\.config\.(ts|js|mjs))$/.test(f));
    const hasCRA = deps["react-scripts"];
    if (hasVite || hasCRA) {
      const port = 8080;
      // Detect package manager
      const hasPnpmLock = files.includes("pnpm-lock.yaml");
      const hasYarnLock = files.includes("yarn.lock");
      const hasPnpmWorkspaces = files.includes("pnpm-workspace.yaml");
      const usePnpm = hasPnpmLock || hasPnpmWorkspaces || (pkg.packageManager && pkg.packageManager.startsWith("pnpm"));
      const useYarn = !usePnpm && hasYarnLock;
      // Detect if it's a monorepo (turborepo / workspaces)
      const isTurbo = files.includes("turbo.json") || pkg.workspaces || hasPnpmWorkspaces;

      const installCmd = usePnpm
        ? "RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm install --frozen-lockfile 2>/dev/null || pnpm install"
        : useYarn
          ? "RUN yarn install --frozen-lockfile 2>/dev/null || yarn install"
          : "RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi";

      // Ensure typescript is available and build; use PATH trick for pnpm global bins
      const buildCmd = isTurbo
        ? usePnpm
          ? "RUN pnpm add -w typescript 2>/dev/null; pnpm run build 2>/dev/null || pnpm turbo run build 2>/dev/null || true"
          : "RUN npm install typescript 2>/dev/null; npx turbo run build 2>/dev/null || npm run build 2>/dev/null || true"
        : usePnpm
          ? "RUN pnpm add -w typescript 2>/dev/null; pnpm run build"
          : "RUN npm run build";

      // Multi-stage: build with node, then collect static output and serve with nginx
      const dockerfile = [
        "FROM node:22-slim AS build",
        "WORKDIR /app",
        "COPY . .",
        installCmd,
        buildCmd,
        // Collect built static files into a known location
        "RUN mkdir -p /static && \\",
        "  (cp -r /app/dist/* /static/ 2>/dev/null || true) && \\",
        "  (cp -r /app/build/* /static/ 2>/dev/null || true) && \\",
        "  (cp -r /app/apps/web/dist/* /static/ 2>/dev/null || true) && \\",
        "  (cp -r /app/apps/web/build/* /static/ 2>/dev/null || true) && \\",
        '  ([ -f /static/index.html ] || cp -r /app/public/* /static/ 2>/dev/null || true) && \\',
        '  ([ -f /static/index.html ] || echo "<html><body>Build output not found</body></html>" > /static/index.html)',
        "",
        "FROM nginx:alpine",
        "COPY --from=build /static /usr/share/nginx/html",
        'RUN echo "server { listen 8080; root /usr/share/nginx/html; location / { try_files \\$uri /index.html; } }" > /etc/nginx/conf.d/default.conf',
        `EXPOSE ${port}`,
        'CMD ["nginx", "-g", "daemon off;"]',
      ].join("\n");
      return {
        runtime: "static",
        dockerfile,
        port,
        buildCommand: "build",
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
