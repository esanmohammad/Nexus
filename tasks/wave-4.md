# Wave 4 — CLI + MCP Server

**Status:** DONE

**Goal:** Developers can use CLI. Claude Code users can deploy via MCP tools.

**Duration:** Week 7-8
**Depends on:** Wave 2 complete (Wave 3 not required)

---

## W4-001: CLI — Package Scaffold

**Depends on:** W3-001
**Files:** `apps/cli/package.json`, `apps/cli/tsconfig.json`, `apps/cli/bin/run.ts`

### Steps
Initialize oclif project with `@nexus/sdk` dependency. Entry point at `bin/run.ts`.

### Acceptance Criteria
- [x] `apps/cli/package.json` exists with name `@nexus/cli`
- [x] `oclif` config section present in package.json
- [x] `bin/run.ts` exists and is executable
- [x] `pnpm --filter @nexus/cli build` succeeds
- [x] Running `./bin/run.ts --help` shows help output

---

## W4-002: CLI — Config & Auth Storage

**Depends on:** W4-001
**Files:** `apps/cli/src/lib/config.ts`, `apps/cli/src/lib/auth.ts`

### Steps
1. `config.ts`: read/write `~/.nexus/config.json` (API URL, default settings)
2. `auth.ts`: read/write token from `~/.nexus/config.json`, token refresh logic

### Acceptance Criteria
- [x] Config stored at `~/.nexus/config.json`
- [x] `getConfig()` reads and returns typed config
- [x] `saveConfig(config)` writes to file
- [x] `getToken()` returns stored JWT or null
- [x] `saveToken(token)` persists JWT
- [x] Creates `~/.nexus/` directory if not exists

---

## W4-003: CLI — `nexus login`

**Depends on:** W4-002
**Files:** `apps/cli/src/commands/login.ts`

### Steps
Google OAuth PKCE flow: open browser to consent URL, start local HTTP server to receive callback, exchange code for token, store token.

### Acceptance Criteria
- [ ] Running `nexus login` opens browser to Google OAuth consent page
- [ ] Local server starts on random available port
- [ ] After consent, callback received and code exchanged for JWT
- [ ] JWT stored in `~/.nexus/config.json`
- [ ] Prints "Logged in as {email}" on success
- [ ] Prints error message on failure

---

## W4-004: CLI — `nexus create`

**Depends on:** W4-002, W3-001
**Files:** `apps/cli/src/commands/create.ts`

### Steps
`nexus create <name> --from ./dir`: tar source directory (excluding node_modules, .git, .env), upload to API, stream build log, print result.

### Acceptance Criteria
- [ ] Accepts sandbox name as argument
- [ ] `--from` flag specifies source directory (default: current dir)
- [ ] Excludes `node_modules/`, `.git/`, `.env`, `dist/` from tar
- [ ] Tar file uploaded to POST `/api/sandboxes`
- [ ] Build log streamed to terminal in real-time
- [ ] On success: prints "v1 is live at {URL}"
- [ ] On failure: prints "Build failed: {error}" and log URL
- [ ] Shows spinner during upload phase

---

## W4-005: CLI — `nexus deploy`

**Depends on:** W4-002, W3-001
**Files:** `apps/cli/src/commands/deploy.ts`

### Steps
`nexus deploy <name>`: tar current directory, upload as new version, stream build log.

### Acceptance Criteria
- [ ] Accepts sandbox name as argument
- [ ] Tars current directory (same exclusions as create)
- [ ] `--label` flag for optional version label
- [ ] Uploads to POST `/api/sandboxes/:id/versions`
- [ ] Build log streamed to terminal
- [ ] On success: prints "v{N} is live at {URL}"
- [ ] On failure: prints error with suggestion

---

## W4-006: CLI — `nexus rollback`

**Depends on:** W4-002
**Files:** `apps/cli/src/commands/rollback.ts`

### Steps
`nexus rollback <name>`: roll back to previous version. `--to vN` for specific version.

### Acceptance Criteria
- [ ] Accepts sandbox name as argument
- [ ] Default: rolls back to previous version
- [ ] `--to` flag accepts version number (e.g., `--to 2`)
- [ ] Prints "Rolled back to v{N}" on success
- [ ] Completes in < 10 seconds
- [ ] Shows confirmation prompt before rollback

---

## W4-007: CLI — `nexus list`

**Depends on:** W4-002
**Files:** `apps/cli/src/commands/list.ts`

### Steps
`nexus list`: display table of user's sandboxes with columns: name, state, version, URL, expires.

### Acceptance Criteria
- [ ] Displays formatted table
- [ ] Columns: Name, State, Version, URL, Expires
- [ ] State shown with color (green=running, yellow=sleeping, etc.)
- [ ] URL truncated if too long
- [ ] Empty state: "No sandboxes found"
- [ ] `--json` flag for JSON output

---

## W4-008: CLI — `nexus info`

**Depends on:** W4-002
**Files:** `apps/cli/src/commands/info.ts`

### Steps
`nexus info <name>`: detailed view of sandbox + all versions.

### Acceptance Criteria
- [ ] Shows all sandbox fields: name, state, URL, owner, TTL, created, access mode
- [ ] Shows version list with number, label, status, deployer, time
- [ ] Current live version highlighted
- [ ] Shows database info if enabled

---

## W4-009: CLI — `nexus versions`

**Depends on:** W4-002
**Files:** `apps/cli/src/commands/versions.ts`

### Steps
`nexus versions <name>`: table of all versions for a sandbox.

### Acceptance Criteria
- [ ] Table columns: Version, Label, Status, Deployed By, Time
- [ ] Live version highlighted
- [ ] `--json` flag for JSON output

---

## W4-010: CLI — `nexus destroy`

**Depends on:** W4-002
**Files:** `apps/cli/src/commands/destroy.ts`

### Steps
`nexus destroy <name>`: confirmation prompt → destroy sandbox.

### Acceptance Criteria
- [ ] Shows confirmation: "Type '{name}' to confirm destruction"
- [ ] Only proceeds if user types exact sandbox name
- [ ] `--confirm` flag skips prompt
- [ ] Prints "Destroyed {name}" on success
- [ ] Prints error if sandbox not found

---

## W4-011: CLI — `nexus extend`

**Depends on:** W4-002
**Files:** `apps/cli/src/commands/extend.ts`

### Steps
`nexus extend <name> --ttl 30d`: extend sandbox TTL.

### Acceptance Criteria
- [ ] Accepts sandbox name as argument
- [ ] `--ttl` flag accepts duration string (e.g., `7d`, `30d`)
- [ ] Parses duration string to days
- [ ] Prints new expiry date on success

---

## W4-012: CLI — `nexus share`

**Depends on:** W4-002
**Files:** `apps/cli/src/commands/share.ts`

### Steps
`nexus share <name>`: update access. Flags: `--team`, `--everyone`, `--email a@b.com`.

### Acceptance Criteria
- [ ] `--team` sets access_mode to `"team"`
- [ ] `--everyone` sets access_mode to `"anyone"`
- [ ] `--email` accepts comma-separated emails, sets access_mode to `"custom"`
- [ ] `--owner-only` resets to `"owner_only"`
- [ ] Prints updated access mode on success

---

## W4-013: CLI — `nexus logs`

**Depends on:** W4-002
**Files:** `apps/cli/src/commands/logs.ts`

### Steps
`nexus logs <name>`: show build log for latest version. `--version N` for specific version.

### Acceptance Criteria
- [ ] Shows build log for latest version by default
- [ ] `--version` flag shows log for specific version
- [ ] Output is plain text, compatible with piping
- [ ] Shows error if no build log available

---

## W4-014: MCP Server — Package Scaffold

**Depends on:** W3-001
**Files:** `apps/mcp-server/package.json`, `apps/mcp-server/tsconfig.json`, `apps/mcp-server/src/index.ts`

### Steps
Initialize MCP server using `@modelcontextprotocol/sdk`. Register server with name "nexus", version "0.1.0", capabilities: `{ tools: {} }`. Use StdioServerTransport.

### Acceptance Criteria
- [ ] `apps/mcp-server/package.json` exists with name `@nexus/mcp-server`
- [ ] `@modelcontextprotocol/sdk` is a dependency
- [ ] `@nexus/sdk` is a dependency
- [ ] Server creates with name `"nexus"` and version `"0.1.0"`
- [ ] Uses `StdioServerTransport`
- [ ] `pnpm --filter @nexus/mcp-server build` succeeds

---

## W4-015: MCP Server — Tool Definitions

**Depends on:** W4-014
**Files:** `apps/mcp-server/src/tools/sandbox-create.ts`, `sandbox-deploy.ts`, `sandbox-rollback.ts`, `sandbox-status.ts`, `sandbox-share.ts`, `sandbox-logs.ts`, `sandbox-list.ts`, `sandbox-destroy.ts`, `sandbox-extend.ts`

### Steps
Define 9 MCP tools with JSON Schema input definitions:
1. `sandbox_create`: name (required), source_path (required), database, ttl_days
2. `sandbox_deploy`: name (required), source_path (required), label
3. `sandbox_rollback`: name (required), target_version
4. `sandbox_status`: name (required)
5. `sandbox_share`: name (required), access_mode (required), emails
6. `sandbox_logs`: name (required), version
7. `sandbox_list`: (no required params)
8. `sandbox_destroy`: name (required), confirm (required boolean)
9. `sandbox_extend`: name (required), ttl_days (required)

### Acceptance Criteria
- [ ] All 9 tools have `name`, `description`, `inputSchema` defined
- [ ] Each `inputSchema` is valid JSON Schema
- [ ] Required fields marked correctly
- [ ] `ListToolsRequest` handler returns all 9 tools
- [ ] Tool descriptions are clear enough for an LLM to use correctly

---

## W4-016: MCP Server — Tool Handlers

**Depends on:** W4-015, W3-001
**Files:** `apps/mcp-server/src/tools/*.ts`

### Steps
Implement handler for each tool:
1. `sandbox_create`: tar source_path, call `sdk.createSandbox`, return human-readable status
2. `sandbox_deploy`: tar source_path, call `sdk.deployVersion`, return status
3. `sandbox_rollback`: call `sdk.rollback`, return status
4. `sandbox_status`: call `sdk.getSandbox`, format as readable text
5. `sandbox_share`: call `sdk.shareSandbox`, return confirmation
6. `sandbox_logs`: call `sdk.getBuildLog`, return log text
7. `sandbox_list`: call `sdk.listSandboxes`, format as table
8. `sandbox_destroy`: verify confirm=true, call `sdk.destroySandbox`
9. `sandbox_extend`: call `sdk.extendSandbox`, return new expiry

### Acceptance Criteria
- [ ] Each handler returns `{ content: [{ type: "text", text: "..." }] }`
- [ ] `sandbox_create` tars directory excluding node_modules/.git/.env
- [ ] `sandbox_deploy` returns "v{N} is live at {URL}"
- [ ] `sandbox_rollback` returns "Rolled back to v{N}"
- [ ] `sandbox_status` returns formatted sandbox info
- [ ] `sandbox_destroy` requires `confirm: true` (refuses otherwise)
- [ ] All handlers catch errors and return readable error messages
- [ ] `CallToolRequest` handler routes to correct handler by tool name

---

## W4-017: MCP Server — Auth Configuration

**Depends on:** W4-014
**Files:** `apps/mcp-server/src/index.ts`

### Steps
Read `NEXUS_API_URL` and `NEXUS_TOKEN` from environment. Initialize `NexusClient` with these values. Document MCP config for users.

### Acceptance Criteria
- [ ] Reads `NEXUS_API_URL` env var (required)
- [ ] Reads `NEXUS_TOKEN` env var (required)
- [ ] Fails with clear error if either is missing
- [ ] `NexusClient` initialized with both values
- [ ] README or config example shows `~/.claude/claude_code_config.json` setup

---

## W4-018: MCP Server — Integration Test

**Depends on:** W4-016
**Files:** `apps/mcp-server/test/tools.test.ts`

### Steps
Test that ListTools returns 9 tools and each CallTool routes to correct handler (mock SDK calls).

### Acceptance Criteria
- [ ] ListTools returns exactly 9 tools
- [ ] Each tool name is unique
- [ ] Calling `sandbox_list` invokes `sdk.listSandboxes`
- [ ] Calling `sandbox_deploy` with valid args invokes `sdk.deployVersion`
- [ ] Calling `sandbox_destroy` without `confirm: true` returns error
- [ ] Test passes with `pnpm --filter @nexus/mcp-server test`

---

## Wave 4 — Final Validation

### CLI Test
```bash
nexus login                              # Opens browser, stores token
nexus create test-app --from ./test-app  # Creates sandbox
nexus deploy test-app --label "v2 fix"   # Deploys v2
nexus list                               # Shows table with test-app
nexus info test-app                      # Shows details
nexus rollback test-app                  # Rolls back to v1
nexus destroy test-app --confirm         # Destroys
```

### MCP Test
```bash
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node apps/mcp-server/dist/index.js
# Should return 9 tools
```

### Wave 4 Complete Criteria
- [ ] All 18 tasks pass acceptance criteria
- [ ] CLI login → create → deploy → rollback → destroy flow works
- [ ] CLI streams build logs to terminal
- [ ] MCP server lists 9 tools
- [ ] MCP tools callable via stdin/stdout JSON-RPC
- [ ] Claude Code can use MCP tools to deploy and manage sandboxes
