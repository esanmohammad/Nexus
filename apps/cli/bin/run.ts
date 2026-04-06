#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args[0] || "help";

async function main() {
  try {
    const mod = await import(`../src/commands/${command}.js`);
    if (mod.default?.run) {
      await mod.default.run(args.slice(1));
    } else if (mod.run) {
      await mod.run(args.slice(1));
    } else {
      console.log(`nexus ${command} — loaded`);
    }
  } catch {
    console.log(`
Nexus CLI — Deploy AI-generated apps

Usage:
  nexus <command> [options]

Commands:
  login       Authenticate with Google OAuth
  create      Create a new sandbox
  deploy      Deploy a new version
  rollback    Roll back to a previous version
  list        List your sandboxes
  info        Show sandbox details
  versions    List versions for a sandbox
  destroy     Destroy a sandbox
  extend      Extend sandbox TTL
  share       Update sandbox access
  logs        Show build logs

Options:
  --help      Show help
  --version   Show version
`);
  }
}

main();
