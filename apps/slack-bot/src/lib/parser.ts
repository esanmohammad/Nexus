export interface ParseResult {
  command: string;
  name?: string;
  target?: string;
  duration?: string;
}

const COMMANDS = [
  "create",
  "deploy",
  "rollback",
  "status",
  "share",
  "extend",
  "destroy",
];

export function parseMessage(text: string): ParseResult {
  // Strip bot mention prefix if present
  const cleaned = text.replace(/<@[A-Z0-9]+>\s*/g, "").trim();
  const parts = cleaned.split(/\s+/);
  const command = parts[0]?.toLowerCase();

  if (!command || !COMMANDS.includes(command)) {
    return { command: "unknown" };
  }

  const name = parts[1];

  if (command === "share") {
    // "share my-app with @user"
    const withIdx = parts.indexOf("with");
    const target = withIdx >= 0 ? parts[withIdx + 1] : undefined;
    return { command, name, target };
  }

  if (command === "extend") {
    // "extend my-app 30d"
    const duration = parts[2];
    return { command, name, duration };
  }

  return { command, name };
}
