# Tools — Standard Agent Vocabulary

Canonical tool names every agent uses. Project-specific parameters from `config.json`. Do not hardcode build/test commands in skills — use these aliases.

## Core tools

| Tool | Action | Native | Source from config |
|------|--------|--------|--------------------|
| `build-backend` | Compile backend | `Shell` | `verification.backendBuild` |
| `test-backend` | Run backend tests | `Shell` | `verification.backendTest` |
| `lint-backend` | Check code style | `Shell` | `verification.backendFormat` |
| `build-frontend` | Compile frontend | `Shell` | `verification.frontendBuild` |
| `test-frontend` | Run frontend tests | `Shell` | `verification.frontendTest` |
| `build-all` | Build both stacks | `Shell` | chain `backendBuild` + `frontendBuild` |
| `migrations-add` | Add EF migration | `Shell` | `verification.migrationsAdd` |
| `migrations-apply` | Apply EF migrations | `Shell` | `verification.migrationsApply` |
| `seed-db` | Seed demo data | `Shell` | `database.seedScript` |
| `start-stack` | Start full stack | `Shell` | `orchestration.startCommand` |
| `stop-stack` | Stop API + Vite | `Shell` | `orchestration.stopCommand` |
| `compose-up` | Docker full stack | `Shell` | `orchestration.composeCommand` |

## State & workflow tools

Resolve `{plans-dir}` from `config.json.plans.dir` (default `.cursor/plans`). `{us-dir}` = `{plans-dir}/{slug}/`. See [`ARTIFACTS.md`](../spec-to-pr/ARTIFACTS.md).

| Tool | Action | Native |
|------|--------|--------|
| `read-state` | Read workflow state | `Read` `{us-dir}/{workflow-id}.state.md` |
| `write-state` | Write/append state | `Write` / `StrReplace` (hygiene before board) |
| `read-config` | Load project config | `Read` `.agents/skills/spec-to-pr/config.json` |
| `read-artifacts-registry` | Canonical artifact names | `Read` `.agents/skills/spec-to-pr/ARTIFACTS.md` |
| `read-stack` | Load stack reference | `Read` `config.json.rules.stackFile` (default `STACK.md`) |
| `read-memory` | Load learned knowledge | `Read` `.agents/skills/shared/self-learning/MEMORY.md` (index via `Grep`) |
| `search-code` | Find patterns in code | `Grep` / `Glob` |
| `run-script` | Run workflow / provider script | `Shell` `python .agents/skills/spec-to-pr/scripts/{name}.py` (orchestrator helpers). Converters/thread helpers: prefer `.agents/skills/{github,azure-devops,local-spec}-provider/scripts/` (shims may still live under `spec-to-pr/scripts/` / `08-fix-pr/scripts/`) |

## Source control tools

| Tool | Action | Native |
|------|--------|--------|
| `commit-code` | Commit src/web/tests only | `Shell` `git add src/ web/ tests/ && git commit -m "..."` |
| `commit-delivery` | Commit plan + result (Step 12) | `Shell` stage `step-02-{slug}.plan.refined.md` **or** `step-01-{slug}.plan.md`, plus `step-12-{slug}.result.md` |
| `push-branch` | Push working branch | `Shell` `git push {gitRemote} {workingBranch}` — from `config.project` |
| `create-pr` | Create PR via SCM provider | Resolve `providers.scm` → [`github-provider`](../github-provider/SKILL.md) or [`azure-devops-provider`](../azure-devops-provider/SKILL.md) `create-pr` (not raw `gh`/`az` alone) |
| `list-threads` / `resolve-thread` / `merge-pr` | PR review + merge intents | Same SCM provider skill as `create-pr` |
| `create-checkpoint` | Tag before step N | `Shell` `git tag uswf/{id}/before-step-{N}` |
| `revert-to-checkpoint` | Revert to tag M | `Shell` `git reset --mixed {tag}` + per-path restore |

Entry / fetch: resolve `providers.active` → [`github-provider`](../github-provider/SKILL.md) · [`azure-devops-provider`](../azure-devops-provider/SKILL.md) · [`local-spec-provider`](../local-spec-provider/SKILL.md) `fetch-to-spec`. Consumers who already installed `spec-to-pr` before these folders existed: `npx github:jpolvora/workflow-skills update --include-new`.

## Agent dispatch tools

| Tool | Action | Native |
|------|--------|--------|
| `dispatch-agent` | Spawn subagent for step | `Task` — `subagent_type: generalPurpose\|shell`; `description: "STP step {N} — {Label}"` |
| `dispatch-parallel` | Spawn ≤3 concurrent DAG tasks | `Task` — same worktree, no file overlap |
| `user-gate` | Ask question | **FORCE `AskQuestion`**: check tool exposed → invoke every normal-mode gate; ≥2 options, recommended first; cancelled → HS-1. Markdown fallback **only** after explicit invoke failure + `askquestion-unavailable` log (see SKILL.md § AskQuestion requirement) |
| `user-gate-auto` | Auto-select first option | auto-gate table — no AskQuestion |
| `browser-mcp` | Browser integration test | `CallMcpTool` `cursor-ide-browser` (only normal mode, non-dry-run, gated) |

## Knowledge tools

| Tool | Action | Native |
|------|--------|--------|
| `update-memory` | Write learned pattern | Create unique file in `self-learning/memory/` and run `python .agents/skills/shared/self-learning/self_learning.py --compile` |
| `update-changelog` | Append historical log | `Write`/`StrReplace` `CHANGELOG.md` |

## Rules

1. **No hardcoded commands** in skills — use tool aliases. Config.json holds project-specific values.
2. **Shell only for git/build/scripts** — never use bash where `Read`/`Write`/`Grep`/`Glob` suffice.
3. **One worktree max** — step 5/10/11 worktrees are exclusive under `{worktrees-dir}`.
4. **No commit of `{plans-dir}/`** — except Step 12 delivery per [`ARTIFACTS.md`](../spec-to-pr/ARTIFACTS.md).
5. **Subagents: fresh per step** — never resume Task across steps.
6. **Orch never edits code** — hard stop. Code changes spawn via `dispatch-agent`.
7. **Paths from config** — never hardcode `.cursor/plans`; always resolve `plans.dir` / `workingBranch` / `baseBranch`.
