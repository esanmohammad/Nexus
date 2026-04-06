# Nexus — Task Breakdown

Each wave is broken into atomic, measurable tasks. Every task has:
- **ID**: `W{wave}-{seq}` (e.g., `W0-001`)
- **Dependencies**: Which tasks must be done first
- **Files**: Exact files to create or modify
- **Acceptance Criteria**: Binary pass/fail checks with zero ambiguity

## Task Files

| File | Wave | Description | Tasks |
|------|------|-------------|-------|
| [prerequisites.md](prerequisites.md) | Pre | GCP, Neon, GitHub account setup | 6 |
| [wave-0.md](wave-0.md) | 0 | Project Scaffolding | 14 |
| [wave-1.md](wave-1.md) | 1 | Core API + Build Pipeline | 22 |
| [wave-2.md](wave-2.md) | 2 | Versioning, Rollback, TTL Cleanup | 16 |
| [wave-3.md](wave-3.md) | 3 | Web UI | 20 |
| [wave-4.md](wave-4.md) | 4 | CLI + MCP Server | 18 |
| [wave-5.md](wave-5.md) | 5 | Slack Bot + Notifications | 14 |
| [wave-6.md](wave-6.md) | 6 | Neon Database Integration | 14 |
| [wave-7.md](wave-7.md) | 7 | GitHub Integration + Promotion | 12 |
| [wave-8.md](wave-8.md) | 8 | Admin Panel + Observability + Polish | 18 |
| [wave-9.md](wave-9.md) | 9 | Cloudflare Zero Trust | 10 |
| [deployment-checklist.md](deployment-checklist.md) | Per-wave | Post-wave validation | 10 |

## Status Legend

- `[ ]` — Not started
- `[~]` — In progress
- `[x]` — Complete
- `[!]` — Blocked

## How to Use

1. Complete all prerequisites before Wave 0
2. Work through waves sequentially (0 → 1 → 2 → ...)
3. Within a wave, tasks are ordered by dependency — work top to bottom
4. Mark each acceptance criterion as you verify it
5. Do not start the next wave until all criteria in the current wave pass
6. Run the deployment checklist after each wave
