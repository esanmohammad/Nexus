/**
 * Wave 1 — Runtime Detection Tests
 * Tasks: W1-008, W1-009, W1-010
 */

import { describe, it, expect } from "vitest";

// ─── W1-008: Runtime Detection Core Logic ────────────────────────────────────

describe("W1-008: Runtime Detection — Core Logic", () => {
  // Import the detection function
  const getDetect = async () => {
    const mod = await import("../../apps/api/src/lib/runtime-detect.js");
    return mod.detectRuntime;
  };

  it("returns RuntimeDetectionResult with required fields", async () => {
    const detectRuntime = await getDetect();
    const result = detectRuntime(
      ["package.json"],
      { "package.json": '{"scripts":{"start":"node index.js"}}' }
    );
    expect(result).toHaveProperty("runtime");
    expect(result).toHaveProperty("dockerfile");
    expect(result).toHaveProperty("port");
    expect(result).toHaveProperty("confidence");
  });

  it("detects existing Dockerfile with high confidence", async () => {
    const detectRuntime = await getDetect();
    const dockerfile = "FROM node:22\nEXPOSE 3000\nCMD [\"node\", \"server.js\"]";
    const result = detectRuntime(
      ["Dockerfile", "server.js"],
      { Dockerfile: dockerfile }
    );
    expect(result.runtime).toBe("dockerfile");
    expect(result.confidence).toBe("high");
    expect(result.dockerfile).toBe(dockerfile);
  });

  it("parses EXPOSE port from existing Dockerfile", async () => {
    const detectRuntime = await getDetect();
    const result = detectRuntime(
      ["Dockerfile"],
      { Dockerfile: "FROM node:22\nEXPOSE 4000\nCMD [\"node\", \"app.js\"]" }
    );
    expect(result.port).toBe(4000);
  });

  it("defaults to 8080 when no EXPOSE in Dockerfile", async () => {
    const detectRuntime = await getDetect();
    const result = detectRuntime(
      ["Dockerfile"],
      { Dockerfile: "FROM node:22\nCMD [\"node\", \"app.js\"]" }
    );
    expect(result.port).toBe(8080);
  });

  it("detects Next.js project (package.json with next dependency)", async () => {
    const detectRuntime = await getDetect();
    const pkg = JSON.stringify({
      dependencies: { next: "^15.0", react: "^19" },
      scripts: { start: "next start", build: "next build" },
    });
    const result = detectRuntime(["package.json"], { "package.json": pkg });
    expect(result.runtime).toBe("nodejs");
    expect(result.port).toBe(3000);
    expect(result.dockerfile).toContain("node");
  });

  it("detects plain Node.js project (package.json with start script)", async () => {
    const detectRuntime = await getDetect();
    const pkg = JSON.stringify({
      scripts: { start: "node server.js" },
    });
    const result = detectRuntime(["package.json"], { "package.json": pkg });
    expect(result.runtime).toBe("nodejs");
    expect(result.port).toBe(8080);
  });

  it("detects Node.js without start script (fallback to index.js)", async () => {
    const detectRuntime = await getDetect();
    const pkg = JSON.stringify({ name: "my-app", dependencies: {} });
    const result = detectRuntime(
      ["package.json", "index.js"],
      { "package.json": pkg }
    );
    expect(result.runtime).toBe("nodejs");
  });

  it("detects Python project (requirements.txt)", async () => {
    const detectRuntime = await getDetect();
    const result = detectRuntime(
      ["requirements.txt", "app.py"],
      { "requirements.txt": "flask==3.0\ngunicorn==22.0" }
    );
    expect(result.runtime).toBe("python");
    expect(result.port).toBe(8080);
    expect(result.dockerfile).toContain("python");
  });

  it("detects Python project (pyproject.toml)", async () => {
    const detectRuntime = await getDetect();
    const result = detectRuntime(
      ["pyproject.toml", "main.py"],
      { "pyproject.toml": "[project]\nname = 'my-app'" }
    );
    expect(result.runtime).toBe("python");
  });

  it("detects Go project (go.mod)", async () => {
    const detectRuntime = await getDetect();
    const result = detectRuntime(
      ["go.mod", "main.go"],
      { "go.mod": "module example.com/myapp\ngo 1.22" }
    );
    expect(result.runtime).toBe("go");
    expect(result.port).toBe(8080);
    expect(result.dockerfile).toContain("go");
  });

  it("detects static site (index.html)", async () => {
    const detectRuntime = await getDetect();
    const result = detectRuntime(
      ["index.html", "style.css"],
      { "index.html": "<html><body>Hello</body></html>" }
    );
    expect(result.runtime).toBe("static");
    expect(result.dockerfile).toContain("nginx");
  });

  it("returns error for unrecognizable projects", async () => {
    const detectRuntime = await getDetect();
    expect(() =>
      detectRuntime(["random.txt"], { "random.txt": "nothing useful" })
    ).toThrow(/runtime|detect|recognize/i);
  });

  it("Dockerfile takes priority over package.json", async () => {
    const detectRuntime = await getDetect();
    const result = detectRuntime(
      ["Dockerfile", "package.json"],
      {
        Dockerfile: "FROM python:3.12\nCMD python app.py",
        "package.json": '{"scripts":{"start":"node index.js"}}',
      }
    );
    expect(result.runtime).toBe("dockerfile");
  });
});

// ─── W1-009: Dockerfile Templates ────────────────────────────────────────────

describe("W1-009: Dockerfile Templates", () => {
  const { readFileSync, existsSync } = require("fs");
  const { resolve } = require("path");
  const ROOT = resolve(__dirname, "../..");

  it("node.Dockerfile exists and has FROM node", () => {
    const path = resolve(ROOT, "infra/dockerfiles/node.Dockerfile");
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("FROM node:");
    expect(content).toContain("WORKDIR /app");
    expect(content).toContain("{{PORT}}");
  });

  it("python.Dockerfile exists and has FROM python", () => {
    const path = resolve(ROOT, "infra/dockerfiles/python.Dockerfile");
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("FROM python:");
    expect(content).toContain("{{PORT}}");
  });

  it("static.Dockerfile exists and has FROM nginx", () => {
    const path = resolve(ROOT, "infra/dockerfiles/static.Dockerfile");
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("nginx");
  });

  it("go.Dockerfile exists and has FROM golang", () => {
    const path = resolve(ROOT, "infra/dockerfiles/go.Dockerfile");
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("golang");
    expect(content).toContain("{{PORT}}");
  });
});

// ─── W1-010: Template Interpolation ──────────────────────────────────────────

describe("W1-010: Runtime Detection — Template Interpolation", () => {
  it("replaces all {{PORT}}, {{BUILD_COMMAND}}, {{START_COMMAND}} placeholders", async () => {
    const { generateDockerfile } = await import(
      "../../apps/api/src/lib/runtime-detect.js"
    );
    const template = `FROM node:22
WORKDIR /app
COPY . .
{{BUILD_COMMAND}}
EXPOSE {{PORT}}
CMD {{START_COMMAND}}`;

    const result = generateDockerfile(template, {
      PORT: "3000",
      BUILD_COMMAND: "RUN npm run build",
      START_COMMAND: '["npm", "start"]',
    });

    expect(result).not.toContain("{{");
    expect(result).toContain("3000");
    expect(result).toContain("npm run build");
    expect(result).toContain("npm");
  });

  it("no unreplaced {{...}} placeholders in output", async () => {
    const { generateDockerfile } = await import(
      "../../apps/api/src/lib/runtime-detect.js"
    );
    const template = "FROM node:22\nEXPOSE {{PORT}}\nCMD {{START_COMMAND}}";
    const result = generateDockerfile(template, {
      PORT: "8080",
      START_COMMAND: '["node", "index.js"]',
    });
    expect(result).not.toMatch(/\{\{.*?\}\}/);
  });
});
