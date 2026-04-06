# Nexus — Test Cases

Test cases organized by wave, mapping 1:1 to task IDs in `/tasks/`.

## Structure

```
tests/
├── wave-0/          # Project scaffolding verification
├── wave-1/          # Core API + build pipeline
├── wave-2/          # Versioning, rollback, TTL
├── wave-3/          # Web UI components + pages
├── wave-4/          # CLI commands + MCP tools
├── wave-5/          # Slack bot handlers
├── wave-6/          # Neon database integration
├── wave-7/          # GitHub integration + promotion
├── wave-8/          # Admin, observability, polish
└── wave-9/          # Cloudflare Zero Trust
```

## Running Tests

```bash
# All tests
pnpm test

# Specific wave (grep by describe prefix)
pnpm --filter @nexus/api test -- --grep "W1-"

# Specific task
pnpm --filter @nexus/api test -- --grep "W1-008"
```

## Conventions

- Every `describe` block is named with the task ID: `W{wave}-{seq}`
- Every `it` block maps to one acceptance criterion
- Mocks are in `__mocks__/` directories
- Integration tests use `integration` in the filename
- All tests use vitest
