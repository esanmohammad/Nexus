import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface NexusConfig {
  apiUrl?: string;
  token?: string;
  [key: string]: unknown;
}

const CONFIG_DIR = join(homedir(), ".nexus");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

const TAR_EXCLUDES = [
  "node_modules/",
  ".git/",
  ".env",
  "dist/",
  ".next/",
  ".turbo/",
];

function ensureDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export async function getConfig(): Promise<NexusConfig> {
  ensureDir();
  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveConfig(config: NexusConfig): Promise<void> {
  ensureDir();
  const existing = await getConfig();
  const merged = { ...existing, ...config };
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
}

export function createTarball(
  sourceDir: string
): { excludes: string[]; dir: string } {
  return {
    excludes: TAR_EXCLUDES,
    dir: sourceDir,
  };
}
