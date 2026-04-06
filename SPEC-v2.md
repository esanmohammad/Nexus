# Nexus — Product Specification v2

**Version:** 2.0
**Date:** 2026-04-06
**Status:** RFC
**Delta from v1:** Added Stripe Minions & DevBox.gg inspiration, Slack-native deploy, MCP integration, blueprint build pipeline, intent-to-deploy UX, and **8 platform differentiators** (Section 18).

---

## 0. Inspiration & Prior Art

This spec is informed by two key references:

### Stripe Minions

Stripe's autonomous coding agents produce 1,300+ PRs/week with zero human-written code. Key lessons:

| Stripe Concept | Our Adaptation |
|----------------|----------------|
| **Devboxes** — pre-warmed EC2 instances, ~10s spin-up, isolated from production/internet. The sandbox *is* the security boundary. | Cloud Run services in isolated VPC with no production access. The sandbox is the trust boundary. |
| **Blueprints** — hybrid workflows: deterministic nodes (lint, git, test) + agentic nodes (implement, fix CI). Constrains LLM scope, saves tokens. | Deploy pipeline uses same pattern: deterministic steps (snapshot → build → deploy) + smart steps (runtime detection, build failure diagnosis). |
| **Toolshed (MCP)** — ~500 internal tools. Agents get curated subsets per task. | Control plane exposes focused MCP tools: `sandbox_create`, `sandbox_deploy`, `sandbox_rollback`, `sandbox_status`, etc. |
| **Slack-native dispatch** — tag a Minion in any thread, it ingests full context and produces a PR. | `@nexus` Slack bot: create/deploy/rollback from any thread. Non-technical users never leave Slack. |
| **Shift feedback left** — local lint <5s, autofix on first CI failure, max 2 iterations. | Pre-build validation (Dockerfile lint, port detection, dep resolution) + one auto-retry on build failure. |
| **Human in the loop** — Minions write code, humans review before merge. | Every version requires human action (click "Deploy" or Slack command). No autonomous deployment. |

### DevBox.gg

"AI-Native Software Delivery Orchestration" — intent-to-deploy for teams using Claude Code and Cursor.

| DevBox Concept | Our Adaptation |
|----------------|----------------|
| **Intent-to-deploy** — unit of work is an *intent* ("I want this live"), not a commit/PR. | Core UX: "make this app available at a URL." Platform handles build, deploy, DNS, auth, cleanup. |
| **AI-native workflow** — designed for AI-generated code, not retrofitted CI/CD. | Optimized for "generate → deploy → iterate" loop, not "branch → PR → review → merge → deploy." |
| **Orchestration, not just hosting** — full lifecycle from code to service. | Control plane orchestrates provision → build → deploy → version → share → cleanup as simple product actions. |

---

## 18. Differentiators — What Makes This Better

Neither Stripe Minions nor DevBox.gg solve our exact problem. Minions target senior engineers automating PRs in a massive monorepo. DevBox.gg targets dev teams orchestrating CI/CD. We target **non-technical people shipping AI-generated apps internally**. Here's what makes our platform unique:

### 18.1 Live Preview Loop (Generate → See → Fix → Ship)

**The gap:** Stripe Minions produce PRs — the output is code, not a running app. DevBox orchestrates delivery but assumes the code already works. Neither closes the loop between *generating* code and *seeing it run*.

**Our approach:** The platform provides a live preview URL from the moment of first deploy. Combined with the MCP integration, the workflow becomes:

```
Claude Code conversation:
  User: "Build me a dashboard that shows email campaign performance"
  Claude: [generates app] [calls sandbox_deploy("campaign-dash", "./")]
  Claude: "Live at https://campaign-dash.nexus.app — take a look"
  User: "The date picker is broken on mobile"
  Claude: [fixes code] [calls sandbox_deploy("campaign-dash", "./")]
  Claude: "v2 is live, try it now"
  User: "Perfect. Share it with the marketing team"
  Claude: [calls sandbox_share("campaign-dash", "team")]
  Claude: "Done — anyone on your team can access it now"
```

The user never leaves the conversation. The app is live and shareable within the same chat where it was created. No other platform does this end-to-end.

### 18.2 Audience-Aware Surfaces (4 channels, 1 API)

**The gap:** Minions are Slack-first but engineer-only. DevBox is a web platform for dev teams. Neither adapts the interaction model to the user's skill level.

**Our approach:** Four interaction surfaces — Web UI, Slack Bot, CLI, MCP Tools — all hitting the same API. The key insight is that different users have different "home" tools:

| User | Home tool | Why |
|------|-----------|-----|
| PM/Analyst | Slack | Already lives there. Won't open a terminal or dashboard. |
| Designer | Web UI | Visual, drag-and-drop, sees screenshot previews. |
| Developer | CLI | Scriptable, integrates with local workflow. |
| Claude Code user | MCP | Never context-switches out of the AI conversation. |

No feature is exclusive to one surface. A sandbox created via Slack can be managed via CLI or Web UI.

### 18.3 Smart Build Recovery (Not Just "Build Failed")

**The gap:** Minions have sophisticated autofix for CI failures, but that's for a monorepo with established test suites. DevBox assumes your code builds. For AI-generated code from non-technical users, build failures are the #1 drop-off point.

**Our approach:** The build pipeline has a "smart recovery" node (inspired by Stripe's blueprint pattern) that:

1. **Parses the build error** into a human-readable summary (not raw Docker output)
2. **Auto-diagnoses common AI-code issues:**
   - Missing `package.json` scripts (`build`, `start`)
   - Wrong Node/Python version
   - Missing environment variables
   - Port mismatch (app listens on 3000, Dockerfile exposes 8080)
   - Missing system dependencies
3. **Attempts one automatic fix** (add missing start script, fix port, add dependency)
4. **If auto-fix fails:** shows the user a plain-English explanation + "Ask Claude to fix this" button that opens a Claude Code session with the error pre-loaded

```
┌─────────────────────────────────────────────────┐
│  Build failed                                    │
│                                                  │
│  What happened: Your app doesn't have a "start"  │
│  command. We tried adding one but it didn't work. │
│                                                  │
│  [Ask Claude to fix this]  [Upload fixed code]   │
│  [View full build log]                           │
└─────────────────────────────────────────────────┘
```

This is the biggest UX differentiator. A non-technical user who hits a build error should never feel stuck.

### 18.4 Sandbox Promotion Path (Prototype → Product)

**The gap:** Minions produce PRs in an existing repo — there's no concept of a standalone app lifecycle. DevBox orchestrates delivery but doesn't model the journey from throwaway prototype to long-lived internal tool.

**Our approach:** Sandboxes have a maturity model:

```
Throwaway          Incubating           Established           Graduated
(TTL: 1-7d)       (TTL: 7-30d)         (TTL: 30-90d)        (Permanent)

No repo            No repo              Repo encouraged       Repo required
No DB              Optional DB          DB + backups          DB + backups
Owner-only         Team access          Team/org access       Org access
Auto-cleanup       Auto-cleanup         Admin approval        No auto-cleanup
                                        to extend             Monitoring enabled
```

Each transition is one click:
- **Promote:** extends TTL, suggests connecting a repo, enables backups
- **Graduate:** requires repo, removes TTL, enables monitoring, notifies platform admins

This means a PM can ship a quick prototype on Monday, and if it becomes valuable, it naturally evolves into a real internal tool — without rebuilding anything.

### 18.5 Screenshot Diffing Between Versions

**The gap:** Neither Minions nor DevBox show *visual* differences between versions. For non-technical users, a source diff is meaningless.

**Our approach:** On every deploy, the platform captures a screenshot of the running app (via headless browser after health check passes). The version timeline shows:

```
┌──────────────────────────────────────────────────────┐
│  Versions                                             │
│                                                       │
│  ● v3 "Added date filters"              LIVE         │
│  ┌─────────────┐  ┌─────────────┐                    │
│  │ [screenshot] │→ │ [screenshot] │  Visual diff      │
│  │  v2          │  │  v3          │  highlighted       │
│  └─────────────┘  └─────────────┘                    │
│  Deployed 2h ago by Marie                             │
│                                                       │
│  ○ v2 "Fixed chart colors"                           │
│  [Roll back to this version]                          │
└──────────────────────────────────────────────────────┘
```

Non-technical users can see exactly what changed between versions without reading code.

### 18.6 "Sandbox as a Deliverable" — Shareable Demo Links

**The gap:** Minions produce PRs (code artifacts). DevBox produces deployed services. Neither is optimized for the use case of *showing something to a stakeholder*.

**Our approach:** Every sandbox has a "Present" mode:

- **Demo link:** `https://campaign-dash.nexus.app?present=true`
  - Hides the sandbox chrome (toolbar, version indicator)
  - Full-screen app experience
  - Still behind Cloudflare Zero Trust (secure)
- **Feedback mode:** Viewers can leave inline comments (pinned to specific UI locations) without any account beyond SSO
- **Expiring share links:** "Share this link for 48 hours" — auto-revokes access after expiry

This makes sandboxes a first-class *deliverable*. A PM generates a dashboard, shares a demo link in a Slack thread, stakeholders click and see a real running app — not a screenshot, not a Figma prototype, not a Loom video.

### 18.7 Cost Transparency Per Sandbox

**The gap:** Minions run on Stripe's massive infra budget. DevBox pricing is per-seat. Neither gives individual users visibility into what their sandbox costs.

**Our approach:** Every sandbox shows its cost in the dashboard:

```
┌────────────────────────────┐
│  campaign-dash              │
│  Cost this month: $3.42    │
│  ├── Compute: $2.80        │
│  ├── Database: $0.50       │
│  └── Storage: $0.12        │
│                             │
│  💡 This sandbox scales to  │
│  zero when idle — no cost   │
│  while nobody's using it.   │
└────────────────────────────┘
```

**Team leads see aggregate cost.** Platform admins see global cost with per-team and per-user breakdown. This creates natural cost accountability without restricting access.

### 18.8 Graceful Degradation on TTL Expiry

**The gap:** Most platforms hard-delete on expiry. Users lose work. Stripe Minions don't have TTLs (persistent infra). DevBox doesn't model ephemerality.

**Our approach:** Instead of immediate destruction, sandboxes go through a graceful wind-down:

```
Timeline:
  T-72h  → Email + Slack: "Your sandbox expires in 3 days" [Extend] [Destroy]
  T-24h  → Email + Slack: "Expiring tomorrow" [Extend]
  T-0    → Sandbox enters "sleeping" state:
           - Cloud Run scaled to 0 (no cost)
           - URL shows "This sandbox has expired" page with:
             [Wake up for 24h]  [Download source]  [Extend]  [Destroy]
           - Source snapshots preserved
           - DB frozen (read-only)
  T+7d   → If still sleeping: final notification + permanent destroy
  T+37d  → Source snapshots deleted (30-day retention after destroy)
```

The "sleeping" state means users never lose work due to an unexpected expiry. They can always download their source or wake the sandbox for one more day.

---

## Summary of Differentiators vs. Prior Art

| Capability | Stripe Minions | DevBox.gg | **Nexus** |
|------------|:-:|:-:|:-:|
| Non-technical users as primary audience | No (engineers only) | Partially | **Yes** |
| Live preview in AI conversation (MCP) | No | No | **Yes** |
| Slack-native full lifecycle | Partial (dispatch only) | No | **Yes (create → destroy)** |
| Smart build recovery for AI-generated code | Yes (autofix) | No | **Yes + human-readable errors** |
| Prototype → production promotion path | No (PRs only) | No | **Yes (4-stage maturity)** |
| Visual diff between versions | No | No | **Yes (screenshot diffing)** |
| Sandbox as shareable deliverable | No | No | **Yes (present mode + feedback)** |
| Per-sandbox cost transparency | No | No | **Yes** |
| Graceful TTL expiry (sleeping state) | N/A | No | **Yes** |
| Zero-trust by default (Cloudflare) | N/A (internal) | No | **Yes (non-negotiable)** |

---

*Sections 1–17 and Appendices A–B are unchanged from SPEC v1. See [SPEC.md](./SPEC.md) for the full base specification.*
