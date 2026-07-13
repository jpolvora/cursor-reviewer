---
name: spec-to-pr
description: >-
  Spec-to-PR delivery orchestrator FSM (F0–F6, steps 0–12; 13 with `--full`). Agent contract only — not human docs.
  Invoke: /spec-to-pr | @[spec-to-pr]. Entry: GitHub issue | Azure DevOps work item | *.spec.md | feature description.
  Flags: dry-run, auto, skip-integration, skip-tests, full, --model, --model-chain. Delegates via Task tool.
  Legacy aliases: /us-workflow, /us-delivery-workflow.
upstream: jpolvora/workflow-skills — this skill is a workflow owned by workflow-skills. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
---

## Audience & load

| Audience | Doc |
|----------|-----|
| **Orchestrator (this file)** | FSM + tool bindings + asserts |
| **Humans** | [`README.md`](README.md), [`docs/faq.md`](docs/faq.md), [`DIAGRAM.md`](DIAGRAM.md) |

**Load:** current step + linked protocols only. Setup → [`setup.md`](setup.md) (config bootstrap, flags, resume). Artifacts → [`ARTIFACTS.md`](ARTIFACTS.md) (canonical paths). Stack → `config.json.rules.stackFile` (auto-loaded steps 5,7,9–11). Hub → [`AGENTS.md`](../../../AGENTS.md). Step 2 → [`02-interview`](../02-interview/SKILL.md). Tools → [`tools.md`](tools.md).

## Language

**All skill content and user-facing output: English.** No PT/PT-BR in instructions, gates, banners, Progress Board.

## Native tool contract

Canonical tool names from [`tools.md`](tools.md). Project params from [`config.json`](.agents/skills/spec-to-pr/config.json). Never narrate undone work.

| Intent | Tool alias | Native | Rule |
|--------|------------|--------|------|
| Step work | `dispatch-agent` | `Task` | `subagent_type: generalPurpose\|shell`; `description: "STP step {N} — {Label}"`; `readonly: true` step 6 only; no resume across steps; step 5 DAG ≤3 parallel |
| User gate | `user-gate` / `user-gate-auto` | `AskQuestion` | ≥2 options; recommended first; cancelled → HS-1; auto → auto-gate |
| Build/test | `build-backend`, `test-backend`, etc. | `Shell` | values from `config.json.verification` |
| Source control | `commit-code`, `push-branch`, etc. | `Shell` | `gh`, `git`; cite real output |
| State | `read-state` / `write-state` | `Read` + `Write`/`StrReplace` | truth source; hygiene before board |
| Search | `search-code` | `Grep`/`Glob` | MEMORY.md index; `{config.plans.dir}/*/*.state.md` resume |
| Browser (step 11) | `browser-mcp` | `CallMcpTool` | normal mode only, non-dry-run, non-skip, gated |
| State check | `run-script validate_state` | `Shell` | optional |
| Code edits | `dispatch-agent` Coder | `Task` | orch never edits — hard stop |

Subagents: native tools for evidence; end with parseable `step-output` block.

User output: post-tool summaries + Progress Board + banners.

---

# Spec-to-PR — Orchestrator

Deterministic FSM; step content delegated to skills via **`Task`**.

## Core Goals
1. **End-to-End Delivery:** Automate the entire feature/US lifecycle from specification bootstrap to PR/Merge (steps 0 to 13).
2. **Context Isolation & State Hygiene:** Run each step in a clean, isolated subagent Task with step-specific worktrees, while keeping state sync (`state.md` + `MEMORY.md`) strictly valid.
3. **Safety & Gates:** Enforce transition gates and model check readiness explicitly before coding and reviewing phases to prevent accidental/incorrect commits.
4. **Portability:** Keep the orchestrator FSM stack-agnostic and configuration-driven, resolving all project metadata and commands dynamically from `config.json` and `stack.md`.

## Invariants

| Topic | Rule |
|-------|------|
| Scope | PR/review/merge out of scope until Step 12 (Step 13 when `fullMode`). No auto push. |
| Auth | G1+ needs gate. AskQuestion cancelled → HS-1. Commit → G2 + explicit menu (HS-2). |
| Isolation | Fresh `Task`/step; `Shell` tag `uswf/{id}/before-step-{N}`; worktree via `Shell` (5/10/11) or branch-direct. |
| State | Hygiene `Write`/`StrReplace` → asserts → board. Fail → HS-5. |
| Memory | `state.md` short-term (`## Workflow memory`, `## Accumulated decisions`, `## Doc consolidation log`). Root `MEMORY.md` = generalizable patterns. |
| `dryRun` | No `Write` `src/`/`web/`, no commit/push/worktree/browser/MEMORY `Shell`/`Write`. Prefix `[DRY-RUN]`. |
| `autoMode` | No AskQuestion; auto-gate option 0. Prefix `[AUTO]`. HS-3/4/5 pause. No browser MCP. |
| `skipIntegration` | Skip Step 11 → `skippedSteps`+`completedSteps`, log, Step 12. |
| `skipTests` | Skip test suites in stack.md; build required. `verification.tests: skipped`. |
| `fullMode` | After Step 12, run Step 13 (Ship & PR): push → create PR → goal-fix-pr loop (5m heartbeat, max 10) → merge. Default: off. |
| Banners | `autoMode` or `dryRun` → Step Output Banner every step. |
| Revert | Workflow manifest + checkpoint only — no global `reset --hard` / `restore .`. |
| Checkpoints | Local tag `uswf/{workflow-id}/before-step-{N}` every boundary. |
| **Workflow artifacts** | **Never `git commit` `.cursor/plans/` files during Steps 0–11.** Code commits (7/10/11 fix) stage `src/`/`web/`/`tests/` only. Delivery commit at Step 12: `step-01-{slug}.plan.md` + `step-12-{slug}.result.md` only. |
| **Pause** | **Pause workflow** keeps **all** artifacts on disk — no cleanup, no delete. `status: active`. |
| `--model` | Set `currentModel` at workflow start. Overrides default. |
| `--model-chain` | Map `{step}:{model}` pairs. Only way to switch models in auto mode. Takes precedence over `--model` at matching steps. Stored in `state.modelChain`. |
| Portability | Keep spec-to-pr fully generic and portable. No hardcoded project-specific metadata, paths, solution names, or commands. All dynamic options and metadata must be resolved from `config.json` or `stack.md`. |

**Legacy aliases** (still accepted): `/us-workflow`, `@[us-workflow]`, `/us-delivery-workflow`, `@[us-delivery-workflow]`.

**Runtime tokens (unchanged):** git tags/worktrees use prefix `uswf/`; plan slugs use `us-{id}`. These are historical tokens, not the skill name.

## Allowed deps

| Resource | Path |
|----------|------|
| Orchestrator | `SKILL.md` |
| **Artifacts** | [`ARTIFACTS.md`](ARTIFACTS.md) — canonical filenames + path resolution |
| **Setup** | `setup.md` — initialization, config bootstrap, flags, resume, stack file generation |
| **Config** | `.agents/skills/spec-to-pr/config.json` — project identity, stack, issue trackers, verification commands, invariants |
| **Tools** | `tools.md` — canonical tool aliases |
| Stack | `config.json.rules.stackFile` — project-specific stack reference; derived from config.json and auto-loaded for code review & optimization |
| Scripts | `check_memory_conflict.py`, `validate_state.py`, `github-issue-to-spec.py`, `ado-workitem-to-spec.py` |
| GitHub | `gh` CLI only |
| State | `{config.plans.dir}/{slug}/{workflow-id}.state.md` |
| Skills | `00-write-spec`→0 · `01-write-plan`→1 · `02-interview`→2 · `03-plan-to-tasks`→3 · `04-implement-tasks`→5 build, 10 fix · `05-verify-plan`→6 · `06-code-review`→9 · `07-integration-validation`→11 · `11-ship-pr`→13 |
| Spec | `spec-format` |

Filesystem paths use numeric prefix; skill `name:` unprefixed. Post-12 PR: [`code-review`](../06-code-review/SKILL.md) / [`fix-pr`](../08-fix-pr/SKILL.md).

### Work dir `{us-dir}` = `{config.plans.dir}/{slug}/` (default `.cursor/plans/{slug}/`)

| Entry | `slug` |
|-------|--------|
| Issue `{id}` | `us-{id}` |
| `*.spec.md` | basename or frontmatter `slug:` |

State: `{us-dir}/{workflow-id}.state.md` · Canonical spec: `{us-dir}/step-00-{slug}.spec.md`.

Artifacts: `step-00-{slug}.issue.json`, `step-00-{slug}.spec.md`, `step-01-{slug}.plan.md`, `step-02-{slug}.plan.refined.md`, `step-03-{slug}.plan.exec.md`, `step-03-{slug}.exec.dag.json`, `step-06-{slug}.plan.report.md`, `step-10-{slug}.report.md`, `step-11-{slug}.integration-test.plan.md`, `step-11-{slug}.integration-test.report.md`, `step-12-{slug}.result.md` (Step 12 delivery summary — committable).

**Committable (Step 12 only):** `step-01-{slug}.plan.md` (or `step-02-{slug}.plan.refined.md` if generated), `step-12-{slug}.result.md`. Other plan-dir files stay uncommitted unless user explicitly asks.

Git-ignored: `worktrees/step-{N}/`, `{workflow-id}.baseline/`, `{workflow-id}.archive/`. Never write state under `.agents/`.

---

## Phases F0–F6 ↔ steps 0–13

```mermaid
flowchart LR
  F0[F0 Bootstrap] --> F1[F1 Specification]
  F1 --> F2[F2 Implementation]
  F2 --> F3[F3 Verify + 1st Commit]
  F3 --> F4[F4 Review + Fix]
  F4 --> F5[F5 Integration]
  F5 --> F6[F6 Closure]
```

| Phase | Steps | Executor |
|-------|-------|----------|
| F0 | 0 | Orchestrator + spec subagent |
| F1 | 1,2,3 | Planner subagent |
| F2 | 4†,5 | Coder subagent |
| F3 | 6,7 | Verifier + orch + shell |
| F4 | 8†,9,10 | Reviewer + Coder |
| F5 | 11 | Verifier + optional browser |
| F6 | 12, 13 | Orchestrator + shell (+ ship subagent when fullMode) |

† Steps **4,8** = model sub-gates — never in `completedSteps`; log `model-gate` in `## Gate history`.

| `completedSteps` | Phase done |
|------------------|------------|
| 0 | F0 |
| 1–3 | F1 |
| 5 | F2 |
| 6–7 | F3 |
| 9–10 | F4 |
| 11 | F5 |
| 12 | F6 (fullMode continues to 13) |
| 13 | F6 (full delivery — fullMode only) |

## Step index

| N | Label | Task? | `subagent_type` | Worktree | RO |
|---|-------|-------|-----------------|----------|-----|
| 0 | Spec Creation | ✓ | GP | — | — |
| 1 | Planning and Brainstorm | ✓ | GP | — | — |
| 2 | Refinement | ✓ | GP | — | — |
| 3 | Execution Plan and DAG | ✓ | GP | — | — |
| 4† | Coder Readiness | — | — | — | — |
| 5 | Implementation (DAG) | ✓ | GP | step-5‡ | — |
| 6 | Verification and Report | ✓ | GP | — | ✓ |
| 7 | Decision and First Commit | ✓ | GP+shell | — | — |
| 8† | Review Readiness | — | — | — | — |
| 9 | Code Review | ✓ | GP | — | — |
| 10 | Fixes, Second Commit and Report | ✓ | GP+shell | step-10‡ | — |
| 11 | Integration Validation and Pre-PR | ✓ | GP+shell | step-11‡ | — |
| 12 | Consolidation and Final Cleanup | ✓ | shell | cleanup | — |
| 13 | Ship & PR (fullMode only) | ✓ | GP+shell | — | — |

‡ [Worktree Fallback](#worktree-fallback). GP = `generalPurpose`. Fixed labels for board/banners. Steps 1 and 2 are conditional and bypassed if [Dynamic Execution](#dynamic-execution-simplicity-first) is active.

---

## Protocols

### Authorization Ladder

| Level | Ops | Gate |
|-------|-----|------|
| G0 | Read, RO reports | — |
| G1 | Edit WT, plans, impl (no commit) | Transition gate |
| G2-code | `git commit` **code only** (`src/`, `web/`, `tests/`) | Step 7 / 10 / 11 fix |
| G2-delivery | `git commit` **`{slug}.plan.md` + `{slug}.result.md` only** | Step 12 delivery gate |
| G3 | `git push`, PR | Step 12 consent; PR manual |

```text
HS-1: AskQuestion cancelled → STOP; re-present gate. Never infer "yes".
HS-2: Commit without explicit gate menu selection → STOP.
HS-2a: `git add` or commit any `.cursor/plans/` path during Steps 0–11 → STOP (workflow artifacts forbidden until Step 12 delivery commit).
HS-3: Mutating step success + empty files_touched → FAILED.
HS-4: Step 5/10/11 success without expected files on state.branch → FAILED.
HS-5: State Hygiene failed → STOP before Progress Board.
```
Auto: HS-3/4/5 apply; HS-1/2 N/A.

### Transition Discipline

**Normal:** N done → Hygiene → checkpoint `before-step-{N+1}` → Board → summary → Transition Gate → dispatch N+1.

**Auto:** auto-gate + dispatch N+1 same turn.

**Forbidden:** mutating step or commit without gate.

### Refinement FSM (Step 2)

2a/2b/2d → `02-interview`. Orch: 2c Escalate, 2e Shared Understanding, redispatch.

| State | Owner | Output |
|-------|-------|--------|
| 2a Audit | refine | `gap_registry[]` by design-tree |
| 2b Resolve | refine | Close with evidence; codebase before escalate |
| 2c Escalate | orch | AskQuestion — **one** question; max 3 rounds; always **End refinement and advance** |
| 2d Exit | refine | §8 empty or `assumed-default`; `shared_understanding: pending` |
| 2e Shared Understanding | orch | **I confirm shared understanding — advance to Step 3** / **Continue refinement** |

Rules: multiple `needs_user` → one by design-tree priority. **End refinement** → log `assumed-default`, gate 2e. Block Step 3 if `refine.shared_understanding !== confirmed`.

### Dynamic Execution (Simplicity First)

To optimize computation costs and process latency, the orchestrator evaluates the complexity of the task/specification before Step 1:
- **Condition:** If the issue/spec represents a minor, surgical, or low-complexity change (e.g., text modifications, documentation-only edits, straightforward single-file configurations, or minor visual fixes with zero cascading side effects):
  - **Decision:** The orchestrator bypasses Step 1 (Planning) and Step 2 (Refinement).
  - **Action:** Jumps directly to Phase F2 / Step 5 (Implementation) using `execMode: sequential` and a blank plan reference.
- **Otherwise:** The orchestrator enforces Step 1 (Planning) and Step 2 (Refinement) to ensure a deep plan is generated and verified before coding.

### Worktree Fallback

```text
dryRun → no worktree
win32 OR path>180 OR git worktree add fails → branch-direct (log ## Gate history)
else → step-worktree
```

branch-direct: edits on `state.branch`; subagent `wip(us-{id}): step-{N}` or dirty WT. Post-step 5/10/11: files exist, expected diff, build/tests per stack.md.

### State Hygiene

After step N, before the progress board, the orchestrator MUST execute State Hygiene. To prevent manual markdown formatting errors and streamline execution, run the automated state update utility.

**Automated State Hygiene Update:**
```bash
python .agents/skills/spec-to-pr/scripts/update_state.py \
  .cursor/plans/{slug}/{workflow-id}.state.md \
  --step {N} \
  --status {completed|failed|skipped} \
  --elapsed {elapsedSec} \
  --tokens {promptTokens}:{completionTokens} \
  --model {modelName} \
  --created "{comma_separated_created_files}" \
  --modified "{comma_separated_modified_files}" \
  --deleted "{comma_separated_deleted_files}" \
  --gate-choice "{gateChoice}"
```

**Manual Fallback (if Python is unavailable):**
```yaml
- Check modelChain[N+1] → if set, update currentModel and log model-chain in ## Gate history
- Append ## Step outputs ### Step N (include model: {modelName} in block)
- Append step-output.learning → ## Workflow memory (dedupe)
- Merge files_touched → ## Step file log ### Step N
- Append to ## Step model log: | Step N | {label} | {model} | dispatched {ISO} |
- Record telemetry: elapsedSec, promptTokens, completionTokens, estimated → ## Telemetry ### Step N
- Append to ## Telemetry log: | Step N | {label} | {model} | {elapsedSec}s | {tokens} |
- Recompute workflowManifest; update completedSteps, stepStatus, currentStep
- Assert created paths exist; currentStep = next gate
- Step 2: ## Refinement registry
```

### Model Readiness Sub-gates

Steps **4†,8†** = model sub-gates at F1→F2 (post-3) and F3→F4 (post-7). Recommend model class (Coder for F2, Reviewer/thinking for F4); gate phase transition explicitly.

Log: `model-gate | F1→F2|F3→F4 | current | recommended | choice | ISO`.

**F1→F2 (after Step 3):** code implementation next.

```text
Current model: {currentModel}
Recommended for coding (Steps 5, 10): Coder-class models

Options:
- Switch to {recommended-coder-model} and advance to Step 5 (Recommended)
- Keep {currentModel} and advance to Step 5
- Choose a different model and advance
- Repeat Step 3
- Go back / Pause
```

**F3→F4 (after Step 7):** review phase next.

```text
Current model: {currentModel}
Recommended for review (Steps 9, 10): Thinking/Reviewer-class models

Options:
- Switch to {recommended-reviewer-model} and advance to Step 9 (Recommended)
- Keep {currentModel} and advance to Step 9
- Choose a different model and advance
- Repeat Step 7
- Go back / Pause
```

Tags `before-step-5`, `before-step-9`. Orch resolves `{recommended-*-model}` to actual model name — never show class names to user.

**Per-step model switch** (every transition gate, steps 0→1 through 11→12): **Switch model and advance** option picks any model without phase recommendation. Sub-gates 4†/8† add class-level recommendation + concrete suggestion.

### Step Dispatch & Isolation

Orch calls **`Task`** — never inline step impl.

```yaml
Task:
  subagent_type: generalPurpose | shell
  description: "STP step {N} — {Label}"
  readonly: true   # step 6 only
  run_in_background: false   # step 5 parallel (DAG): ≤3 parallel, same worktree, no file overlap
```

Anchor (`Shell` tag): `uswf/{workflow-id}/before-step-{N} @ {sha}`. Worktree 5/10/11 via `Shell`: `worktree add` → merge → `worktree remove` → `branch -d`. Max 1 active. Audit: `Write` `stepDispatches[]`. No per-DAG-task worktree.

**Step 5 dispatch:**
- `execMode: sequential` → single `Task` `04-implement-tasks` mode `build` with `step-01-*.plan.md` directly (no DAG).
- `execMode: parallel` → DAG: `Task` per level, ≤3 concurrent, no file overlap within level.

### Learning & Memory Protocol

**Purpose:** Prevent repeating mistakes across steps and across workflow runs. `state.md` acts as the intra-workflow knowledge bus, while `MEMORY.md` (root) is the cross-session, persistent anti-regression knowledge base.

#### 1. Pre-read Checklist (Memory Consultation)
At the start of every step, the subagent MUST read the following sections:

| Source | Section | Purpose |
|--------|---------|---------|
| `state.md` | `## Workflow memory` | Traps, gotchas, fixes from prior steps — **do not repeat mistakes** |
| `state.md` | `## Accumulated decisions` | Design choices, assumption flags, deviations from plan |
| `state.md` | `## Step outputs` (all `### Step N` blocks) | Prior errors, retry patterns, broken approaches |
| `state.md` | `## Doc consolidation log` | Docs updated during workflow |
| `MEMORY.md` | Index + scope-related sections | Generalizable anti-regression patterns from past workflows |
| `check_memory_conflict.py` | script output | Conflict detection (steps 2,3,5,9,10) |

- **Intra-workflow Avoidance:** Scan `## Step outputs ### Step N` for `errors[]` and `learning` fields. Subagent MUST NOT repeat approaches that prior steps logged as broken.

#### 2. Writing Back Learndings
After step completion, the subagent records in `step-output.learning` (mistakes made, traps/constraints found). The orchestrator appends these to `state.md` `## Workflow memory`.

#### 3. Inter-workflow Promotion (Step 12 Sweep)
At Step 12, the orchestrator reviews all `## Workflow memory` and `step-output.learning` entries, promoting generalizable patterns to `MEMORY.md`.
- **Promotion Criteria:** Technical (framework/api/pattern level, not domain-specific), generalizable, non-duplicate (grep `MEMORY.md` first), and concise (one line per trap).
- **Target Sections:** `## Patterns`, `## Traps`, `## Review Patterns`, `## Index`.
- **Exclusions:** Do NOT store logs (→ `CHANGELOG.md`), domain rules (→ `CONTEXT.md` / `specs/`), narratives, or duplicates.
- **`dryRun`:** Log proposed entries in `## Doc consolidation log` only — do not edit `MEMORY.md`.

### Specification Protocol

[`spec-format`](./extra-skills/spec-format/SKILL.md). Canonical spec: `{us-dir}/step-00-{slug}.spec.md` — never live tracker APIs and never `*.issue.json` after Step 0. Tracker config: `config.json.issueTrackers`.

| Input | Tracker | Action | Uses Step 0? |
|-------|---------|--------|--------------|
| `{n}` or `US {n}` | GitHub (default when `issueTrackers.github.enabled`) | `slug=us-{n}`; fetch → convert → `{us-dir}/step-00-us-{n}.spec.md` | No — skip to Step 1 |
| `{org}/{project}#{id}` | Azure DevOps | `slug=us-{id}`; fetch → convert → `{us-dir}/step-00-us-{id}.spec.md` | No — skip to Step 1 |
| `ADO {id}` / `WI {id}` | Azure DevOps | Same as above; org/project from `issueTrackers.azureDevOps` | No — skip to Step 1 |
| `*.spec.md` (any path) | Hand-written / local | Register/copy → `{us-dir}/step-00-{slug}.spec.md` | No — skip to Step 1 |
| free-text / no args | none | brainstorm → `00-write-spec` → `{us-dir}/step-00-{slug}.spec.md` (optional mirror `{specs-dir}/{slug}.spec.md`) | Yes — `Task` `00-write-spec` |

**Bare number resolution:** if only `azureDevOps.enabled` and GitHub disabled → treat `{n}` as ADO work item. If both enabled → bare `{n}` = GitHub; require `ADO {id}` or `{org}/{project}#{id}` for ADO. If the required tracker is disabled or unauthenticated → STOP with fix instructions.

#### GitHub (`gh`) — concrete steps

Requires `issueTrackers.github.enabled: true` and authenticated `gh` (`gh auth status`).

```bash
mkdir -p .cursor/plans/us-{n}
gh issue view {n} --json number,title,body,state,labels,assignees,comments,url \
  > .cursor/plans/us-{n}/step-00-us-{n}.issue.json
python .agents/skills/spec-to-pr/scripts/github-issue-to-spec.py \
  --input .cursor/plans/us-{n}/step-00-us-{n}.issue.json \
  --output .cursor/plans/us-{n}/step-00-us-{n}.spec.md \
  --repo {owner}/{repo}
```

`owner`/`repo` from `issueTrackers.github` (or `project.org` / repo name). Script path may also come from `issueTrackers.github.issueToSpecScript`.

#### Azure DevOps — concrete steps

Requires `issueTrackers.azureDevOps.enabled: true`, org/project filled, and PAT in env (`ADO_PAT` or `patEnvVar` / `AZURE_DEVOPS_PAT`).

```bash
mkdir -p .cursor/plans/us-{id}
python .agents/skills/spec-to-pr/scripts/ado-workitem-to-spec.py \
  --org {org} --project {project} --id {id} \
  --api-base {apiBase} --pat-env {patEnvVar} \
  --snapshot .cursor/plans/us-{id}/step-00-us-{id}.issue.json \
  --output .cursor/plans/us-{id}/step-00-us-{id}.spec.md
```

Values from `issueTrackers.azureDevOps`. Script path may also come from `issueTrackers.azureDevOps.workItemToSpecScript`.

#### Hand-written local `*.spec.md` — concrete steps

Accepts any existing markdown spec path (`specs/foo.spec.md`, `foo.spec.md`, or already `step-00-foo.spec.md`).

1. Resolve `slug`: frontmatter `slug:` if present, else basename without `.spec.md` (strip leading `step-00-` if present).
2. `mkdir -p {us-dir}` where `{us-dir}={plans-dir}/{slug}/`.
3. Copy/normalize to `{us-dir}/step-00-{slug}.spec.md` (overwrite only if identical or user confirms).
4. Ensure frontmatter has at least `slug`, `title`, `source: local` (add `source: local` if missing). Validate required sections per [`spec-format`](./extra-skills/spec-format/SKILL.md).
5. Do **not** call tracker APIs. Optional: mirror to `{specs-dir}/{slug}.spec.md` for human browsing.

### Step 0 Entry Gate

Before Step 0, the orchestrator checks the trigger input and determines the entry flow:

1. **Tracker id** (`{n}`, `US {n}`, `ADO {id}`, `WI {id}`, or `{org}/{project}#{id}`):
   - Fetch + convert per Specification Protocol → `{us-dir}/step-00-{slug}.spec.md`.
   - Registers `specPath`, `specSource` (`github` | `azure-devops`).
   - **Skips Step 0** — advances directly to the Step 1 gate.

2. **Local `*.spec.md` provided as argument:**
   - Register/copy per hand-written protocol. Registers `specPath`, `specSource: local`.
   - **Skips Step 0** — advances directly to the Step 1 gate.

3. **No arguments (or free-text description as argument):**
   - Entry Menu (AskQuestion):
     - **I have a GitHub issue / ADO work item** (recommended) — same as case 1; skip Step 0 → Step 1.
     - **I have a local `*.spec.md`** — same as case 2.
     - **I want to describe a feature to brainstorm** — `Task` `00-write-spec` → `{us-dir}/step-00-{slug}.spec.md` → Step 1 gate. **This is the only path that uses `00-write-spec`.**

After the entry gate, `specPath` is stored in state `## Artifacts.specPath` and snapshotted in `## Artifacts.specSnapshot`.

### Build & Test Validation (7, 10)

Before G2-code commit: `config.json.rules.stackFile` → build (+ tests unless skip) → Coder fix loop. Stage **only** `src/`, `web/`, `tests/` — never `.cursor/plans/`. `skipTests`: `verification.tests: skipped`.

### Integration Validation (11)

`07-integration-validation` via **`Task`**.

| Flag | Effect |
|------|--------|
| `skipIntegration` | no Task; Write skip → step 12 |
| `autoMode` \| `dryRun` | Task without browser; §6 skipped in report |
| normal + gate | `CallMcpTool` cursor-ide-browser |

Gates (normal): **Approve and run test battery** (rec) / **Run without browser** / **Adjust test plan** / **Skip validation** / **Pause workflow**.

Failure (max 3): **Apply fixes and revalidate** (rec) / **Accept with reservations** / **Re-run without fixes** / **Pause**. Fix: G2-code commit only (`src/`/`web/`/`tests/`).

### Workflow Artifact Commit Protocol

| When | Allowed |
|------|---------|
| Steps 0–11 | **Code only** under `src/`, `web/`, `tests/` at Steps 7, 10, 11 fix |
| Steps 0–11 | **Forbidden:** `.cursor/plans/**`, `*.plan.exec.md`, `*.exec.dag.json`, `*.report.md`, `*.plan.report.md`, `*.integration-test.*`, `*.state.md`, `*.issue.json` |
| Step 12 | **`{slug}.plan.md`** (checkmarks updated) + **`{slug}.result.md`** — delivery commit via G2-delivery gate |
| Pause | No commit required; **no delete** of workflow files |

Orch `git add` must be path-scoped — never `git add .` on steps 7/10/11.

### Delivery Result Protocol (Step 12 — before delivery commit)

1. **`Read`** sources: `step-00-{slug}.spec.md`, `step-02-{slug}.plan.refined.md` (or `step-01-{slug}.plan.md` if Step 2 was bypassed), `step-06-{slug}.plan.report.md`, `step-10-{slug}.report.md`, integration report if exists, `## Open items` in state.
2. **`Write`** `{us-dir}/step-12-{slug}.result.md`:

```markdown
# {slug} — Delivery Result

## Expected
<!-- from spec ACs + plan scope -->

## Done
<!-- from verify report + delivery report + completed DAG tasks -->

## Next steps
<!-- open items, reservations, manual follow-ups before PR -->

## References
- Spec: {specPath}
- Plan: step-02-{slug}.plan.refined.md (or step-01-{slug}.plan.md if Step 2 was bypassed)
- Verify: step-06-{slug}.plan.report.md
- Delivery: step-10-{slug}.report.md
```

3. **Capture LOC delta:** `Shell` from repo root:
   - Baseline LOC: `git ls-files src/ web/ tests/ | xargs git show {baselineCommit}: 2>/dev/null | wc -l`
   - Final LOC: `git ls-files src/ web/ tests/ | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}'`
   - Diff stat: `git diff --stat {baselineCommit} -- src/ web/ tests/ | tail -1`
   - Parse added/removed; store in `telemetry.loc`.
4. **Compute benchmark:** aggregate `telemetry.steps[].elapsedSec` → `totalElapsedSec`; sum `promptTokens + completionTokens` → `totalTokens`; compute `netDelta = added - removed`.
5. **Append Benchmark** to `step-12-{slug}.result.md` per template below; populate from `telemetry.steps[]`.
6. **Update plan checkmarks:** mark completed tasks/ACs `[x]` per verify report + `completedTasks` + `completedSteps` ≥5.
7. Register `resultSnapshot` + `telemetry.workflowEndedAt` in state `## Artifacts`.
8. **G2-delivery gate** → `Shell` stage `step-01-{slug}.plan.md` + `step-02-{slug}.plan.refined.md` (if generated) + `step-12-{slug}.result.md` → `git commit -m "docs({slug}): delivery plan and result"`.
9. Log `step-12-delivery-commit | {sha}` in `## Gate history` and `commits[]`.

`dryRun`: simulate result + plan edits + benchmark; no real commit.

### Optional Artifact Cleanup Protocol (Step 12 — after delivery commit)

**Only when `status: completed` and user explicitly chooses cleanup** — never on **Pause workflow**.

**Gate options:**
- **Delete temporary artifacts** (rec if lean repo) — `step-03-*.plan.exec.md`, `step-03-*.exec.dag.json`, `step-00-*.issue.json`, `step-06-*.plan.report.md`, `step-11-*.integration-test.*.md`, worktrees, baseline, archive, checkpoint tags
- **Keep all artifacts** (rec for audit) — no delete

**Cleanup execution (when user chooses delete):**

1. Delete temp files:
   ```bash
   rm {us-dir}/step-03-{slug}.plan.exec.md
   rm {us-dir}/step-03-{slug}.exec.dag.json
   rm {us-dir}/step-00-{slug}.issue.json
   rm {us-dir}/step-06-{slug}.plan.report.md
   rm {us-dir}/step-11-{slug}.integration-test.plan.md
   rm {us-dir}/step-11-{slug}.integration-test.report.md
   ```
2. Remove checkpoint tags:
   ```bash
   git tag -l "uswf/{workflow-id}/*" | xargs -r git tag -d
   ```
3. Remove worktree dirs + prune branches:
   ```bash
   git worktree list | grep "uswf/{workflow-id}" | awk '{print $1}' | while read wt; do
     git worktree remove "$wt" --force 2>/dev/null
   done
   git branch -l "uswf/{workflow-id}/*" | sed 's/^[* ]*//' | xargs -r git branch -D
   ```
4. Remove baseline backup: `rm -rf {us-dir}/{workflow-id}.baseline/`
5. Remove archive: `rm -rf {us-dir}/{workflow-id}.archive/`

**Preserved (never deleted):** `step-01-{slug}.plan.md`, `step-02-{slug}.plan.refined.md` (if generated), `step-12-{slug}.result.md`, `step-00-{slug}.spec.md`, `{workflow-id}.state.md` (while `status: active`).

**Post-cleanup verification:**
```bash
git worktree list | grep "uswf/{workflow-id}" && echo "WARN: worktree remains" || echo "Clean"
git tag -l "uswf/{workflow-id}/*" | wc -l | xargs -I{} echo "Tags remaining: {}"
git branch -l "uswf/{workflow-id}/*" | wc -l | xargs -I{} echo "Branches remaining: {}"
```

**Pause / `status: active`:** skip cleanup entirely; all files remain for resume. **Dry-run:** log intended deletions only.



### Telemetry & Benchmarking

Orch records wall-clock time, token usage, LOC delta at every step boundary. At Step 12, consolidated benchmark appended to `{slug}.result.md` and Progress Board.

#### Timing

| Event | Record | Field |
|-------|--------|-------|
| Workflow start | `telemetry.workflowStartedAt` | ISO 8601 (bootstrap) |
| Step N dispatch | `telemetry.steps[N].dispatchedAt` | ISO 8601 (before `Task`/`Shell`) |
| Step N finish | `telemetry.steps[N].finishedAt` | ISO 8601 (after return) |
| Step N elapsed | `telemetry.steps[N].elapsedSec` | `(finishedAt - dispatchedAt) / 1000` (int, seconds) |
| Workflow end | `telemetry.workflowEndedAt` | ISO 8601 (Step 12, before cleanup) |
| Total elapsed | `telemetry.totalElapsedSec` | sum of all step `elapsedSec` |

Gate time (AskQuestion waiting) excluded — agent execution time only.

#### Token counting

| Field | Source | Fallback |
|-------|--------|----------|
| `promptTokens` | LLM metadata | estimate: prompt chars / 3.5 |
| `completionTokens` | LLM metadata | estimate: completion chars / 3.5 |
| `totalTokens` | sum | estimate: (prompt + completion chars) / 3.5 |

Labeled `(est.)` when estimated. `Shell` steps (7, 12, 13): elapsed time only; tokens=0.

#### Lines of code delta

At bootstrap + Step 12 delivery:

```bash
# Baseline (bootstrap)
git ls-files src/ web/ tests/ | xargs wc -l 2>/dev/null | tail -1

# Diff (Step 12)
git diff --stat {baselineCommit} -- src/ web/ tests/ | tail -1
```

| Field | Description |
|-------|-------------|
| `telemetry.loc.baseline` | total lines at `baselineCommit` |
| `telemetry.loc.final` | total lines at Step 12 commit |
| `telemetry.loc.added` | `+` lines from diff |
| `telemetry.loc.removed` | `-` lines from diff |
| `telemetry.loc.netDelta` | `added - removed` |

Count only `src/`, `web/`, `tests/`.

#### Step output telemetry contract

```yaml
step-output:
  telemetry:
    elapsedSec: {int}
    promptTokens: {int|null}
    completionTokens: {int|null}
    estimated: {boolean}
```

Orch: validate `telemetry` block → merge into `telemetry.steps[N]`. Missing → HS-5.

#### Benchmark report (Step 12)

```markdown
## Benchmark

| Metric | Value |
|--------|-------|
| Total wall-clock time | {h}h {m}m {s}s ({totalElapsedSec}s agent execution) |
| Steps executed | {N} |
| Total tokens | {sum} (estimated: {bool}) |
| Lines added | +{added} |
| Lines removed | -{removed} |
| Net LOC delta | +{netDelta} |
| Baseline LOC | {baseline} |
| Final LOC | {final} |

### Step breakdown

| Step | Label | Model | Elapsed | Tokens (est.) | Files changed |
|------|-------|-------|---------|---------------|---------------|
| 0 | Spec Creation | {model} | {elapsedSec}s | {tokens} | {n} |
| 1 | Planning | {model} | {elapsedSec}s | {tokens} | {n} |
```

**Token efficiency:** `tokens/loc` ratio. **Velocity:** `loc/min`.

### Step Output Banner

When `autoMode` or `dryRun`, before and after each step:

```markdown
[AUTO] [DRY-RUN] **Starting step {N} {Label}**
[AUTO] **Finished step {N} {Label}**
```

Step 5: one pair per whole step. Print **Finished** on hard stop too.

### Automatic Mode

Parse: `auto` + combinable `dry-run`, `skip-integration`, `skip-tests`, US/spec entry. Legacy user input may pass `automatico`/`automático`; normalize to `auto` internally.

Resume: active `autoMode` same US → continue `currentStep`; else new `workflow-id`.

| Context | Auto choice (index 0) |
|---------|----------------------|
| Step 0 entry gate | **I have a US/issue number** (user must provide in invocation) |
| Transition 1–6, 9–10 | **Advance to Step N+1** |
| Transition model change (auto) | **Advance to Step N+1** (keep current model; auto mode cannot switch models mid-flow — use `--model-chain` or pause to normal) |
| Model sub-gate | **Continue with current model** |
| `--model-chain` lookup | auto-applies pre-specified model; overrides index 0 |
| Step 2 needs_user | first option; early → **End refinement and advance** → 2e |
| Step 2e | **I confirm shared understanding — advance to Step 3** |
| Step 7 | **Approve, validate build/tests and commit code** |
| Step 11 skipIntegration | skip step |
| Step 11 plan | **Approve and run test battery without browser** |
| Step 11 failure | **Apply fixes and revalidate** |
| Step 12 delivery | **Commit plan and result** |
| Step 12 cleanup | **Keep all artifacts on disk** (default safe) or delete temps |
| Step 12 §Doc | **Nothing to update / Skip** |
| Step 12 push | **Do not push now** |
| Step 13 gate (fullMode) | **Create PR, monitor, and merge when ready** |

Log `auto-gate | step {N} | {choice} | ISO`. Disabled: backward/repeat/pause menus; Step 3 without shared understanding.

### Checkpoints

Tag `uswf/{workflow-id}/before-step-{N}` = HEAD before step N first mutation. `before-step-1` = `baselineCommit`. Mirror in `checkpoints[]`. Delete on Step 12/reset. Dry-run: log only.

### Progress Board

Render: bootstrap/resume; after each step (post-hygiene, pre-gate); pause; `/status`; Step 12 final.

```markdown
## Progress — US {us} (`{workflowId}`)
**Status:** … | **Phase:** {Fx} | **Step:** {N} — {label} | **Branch:** `{branch}` | **Mode:** {autoMode→[AUTO] / dryRun→[DRY-RUN] / fullMode→[FULL] / normal}
**Current model:** {currentModel} | **Step models:** {list}

### Pipeline — Phases
- [x] F0 Bootstrap · [ ] F2 Implementation ← **next** …

### Steps (0–12; +13 when fullMode, omit 4/8)
- [x] 0 [{model}] · [x] 1 [{model}] · … · [ ] 5 ← **next** [{currentModel}]

### Refinement _(Step 2 active only)_
Round {r}/3 · blocking: {n}

### Step 3 Execution Mode _(after Step 3)_
**Mode:** {execMode} · {reason}

### Step 5 DAG _(if execMode: parallel)_
- [x] T1 — …
```

Suffixes: `← next` · `⏭ skipped` · `↻ repeating` · `⏮ reopened`.

**Step 12 final board** — after benchmark:

```markdown
### Telemetry
| Metric | Value |
|--------|-------|
| Total time | {h}h {m}m {s}s ({totalElapsedSec}s) |
| Total tokens | {tokens} (est: {bool}) |
| Lines +/- | +{added} / -{removed} (net: {netDelta}) |
| Token efficiency | {tokens/loc} tokens/LOC |
| Velocity | {loc/min} LOC/min |
```

### Safe Revert & Backward Navigation

**Revert** = manifest to checkpoint M. Scope: `reset --mixed` → per-path restore from `## Step file log` → remove worktrees ≥M → truncate state <M. Verify `preExistingDirty`. Forbidden: global `reset --hard`, `checkout -- .`, `restore .`, `clean -fd`, stash, push `uswf/*` tags.

**Bootstrap revert data:** `baselineCommit`, `preExistingDirty[]`, backup `{workflow-id}.baseline/`. Full reset: M=1 + new workflow-id.

**Backward nav** (normal only): Gate **Go back** or Step 7→5 shortcut. Targets: 1–3,5–7,9–11 in `completedSteps`. Sub-menu: Planning/Implementation/Review/Validation → confirm → checkpoint revert → redispatch M. Log `backward-nav | from | to | ISO`.

---

## State & dispatch

### `state.md` YAML

```yaml
workflowId, slug, us, specSource, specPath
startedAt, endedAt, status: active|completed|cancelled|failed
currentStep, dryRun, autoMode, skipIntegration, skipTests, fullMode
execMode: sequential|parallel|null  # set after Step 3
branch, baselineCommit, preExistingDirty: []
checkpoints, workflowManifest, commits: [{sha, step, message}]
completedSteps, stepStatus, skippedSteps, completedTasks, stepDispatches
refineRound, currentModel, recommendedModel
stepModels: [{step: N, model: "name", dispatched: ISO}]
modelChain: {stepNumber: "modelName"}  # from --model-chain flag
telemetry:
  workflowStartedAt: ISO
  workflowEndedAt: null
  totalElapsedSec: null
  loc:
    baseline: int|null
    final: int|null
    added: int|null
    removed: int|null
    netDelta: int|null
  totalTokens: int|null
  steps: [{ N: int, label: str, dispatchedAt: ISO, finishedAt: ISO, elapsedSec: int, promptTokens: int, completionTokens: int|null, estimated: bool, model: str, filesTouched: int }]
```

Sections: Workflow baseline, manifest, Step file log, Refinement registry, Context, Artifacts, Step outputs, Step model log, Workflow memory, Accumulated decisions, Doc consolidation log, Open items, Gate history.

### Resume / reset

Delegated to [`setup.md`](setup.md) § Resume / reset. The orchestrator loads this section during bootstrap step 4.

---

### Base Prompt Prefix (`Task` body)

```markdown
# Subagent — Step {STEP} — {Label}
Read state: `.cursor/plans/{slug}/{workflow-id}.state.md`
Skill: {SKILL.md path} — read full.
Orch: SKILL.md § Step {STEP} · model {currentModel} · {modeFlags}
Enhancing skills (mandatory): karpathy-guidelines, gabarito, caveman
Read: state workflow memory + decisions + doc log; MEMORY.md index; `config.json.rules.stackFile`.
Anchor: uswf/{workflow-id}/before-step-{STEP} @ {sha} · CWD: {repo-root | worktree}
Role: fresh; no resume. files_touched required (revert). model: {currentModel}.
Rules: no `.cursor/plans/` in git-add except Step 12 G2-delivery; needs_user: ≥2 choices, recommended first.
Learning: read ## Workflow memory + ## Step outputs (all prior steps) for traps/errors. Do NOT repeat broken approaches. Record own mistakes in step-output.learning.
Telemetry required: record elapsedSec (step wall-clock seconds = (finishedAt - dispatchedAt) / 1000, integer), promptTokens + completionTokens (from LLM metadata if available, else estimate chars/3.5 with estimated: true).
End with ```step-output(status, step, artifacts, files_touched, verification, refine, summary, evidence, decisions, doc_consolidation, needs_user, errors, retry_hint, learning, model, telemetry{elapsedSec, promptTokens|null, completionTokens|null, estimated})
```
```

### Transition Gates

Post-step: hygiene → checkpoint (`Shell` tag) → board → gate.

| Mode | Tool |
|------|------|
| auto | auto-gate table → immediate `Task`/`Shell` |
| normal | **AskQuestion** 5 options → `Task` same turn |

**AskQuestion (normal) — every transition gate, steps 0→1 through 11→12:**

Shows `**Current model:** {currentModel}` and `**Next step:** {N+1} — {Label}`.

- **Advance to Step N+1** (rec) — keep `{currentModel}`
- **Switch model and advance** — explicit available model list. Suggested by next step role:
  - **Planner/Design** (0–3): thinking/reasoning models
  - **Coder/Implementation** (5, 10, 11): code-generation models
  - **Reviewer/Analysis** (6, 9): thinking models
  - **General** (7, 12, 13): balanced models
  Updates `currentModel`; logs `model-change | step {N}→{N+1} | {old} → {new} | ISO`.
- **Repeat Step N** — revert M=N if partial → `Task`
- **Go back to earlier step** → [Backward Navigation](#safe-revert--backward-navigation)
- **Pause or cancel workflow** → **Pause** (rec — keeps all artifacts, `status: active`) / Cancel without revert / Cancel and revert all

**Model switch sub-menu (concrete names, never generic classes):**

```text
Current model: {currentModel}
Next step: {N+1} — {Label}

Choose model for Step {N+1}:
- {model-1} (Recommended)
- {model-2}
- {model-3}
- {model-4}
- Other — type exact model name
```

Step 11: **Skip validation**. Step 2: gate 2e before Step 3.

**Model recording:** every `## Step outputs ### Step N` block includes `model: {modelName}`. Append to `## Step model log`:

```markdown
| Step N | {label} | {model} | dispatched {ISO} |
```

---

## Bootstrap & Entry

Delegated to [`setup.md`](setup.md) § Bootstrap & Entry. Before Step 0, the orchestrator loads and executes this section.

---

## Step instructions

| Step | Action | Artifact |
|------|--------|----------|
| 0 | Entry gate (AskQuestion). US/spec provided → skip to Step 1. No args → free-text description → `Task` `00-write-spec`. Register specPath. | `step-00-{slug}.spec.md` |
| 1 | `Task` `01-write-plan` + specPath (Bypassed if Dynamic Execution active) | `step-01-{slug}.plan.md` |
| 2 | `Task` `02-interview`; FSM 2c/2e; block Step 3 until 2e confirmed (Bypassed if Dynamic Execution active) | `step-02-{slug}.plan.refined.md` |
| 3 | `Task` `03-plan-to-tasks`; detect plan size → `execMode`. Sequential → skip DAG. Parallel → DAG. | `step-03-{slug}.plan.exec.md`, `step-03-{slug}.exec.dag.json` |
| 4† | Model sub-gate F1→F2 | not in completedSteps |
| 5 | `Task` `04-implement-tasks` mode build; worktree. `sequential` → single Task. `parallel` → DAG ≤3/level. | verification |
| 6 | `Task` `05-verify-plan` readonly | `step-06-{slug}.plan.report.md` |
| 7 | AskQuestion G2-code → Shell build/test → `git commit` code `feat(us-{id}): US {id} implementation` | commit; no `.cursor/plans/` |
| 8† | Model sub-gate F3→F4 | not in completedSteps |
| 9 | `Task` `06-code-review`; scoped diff per `config.json.rules.stackFile` | score ≥6 or "No feedback" |
| 10 | `Task` `04-implement-tasks` mode fix; G2-code only; `step-10-{slug}.report.md` uncommitted | HS-3/4 |
| 11 | skipIntegration→Write skip; else `Task` `07-integration-validation`; browser if gated | reports uncommitted (`step-11-{slug}.integration-test.*`) |
| 12 | [Delivery Result Protocol](#delivery-result-protocol-step-12--before-delivery-commit) → LOC capture + benchmark → G2-delivery commit → optional [cleanup](#optional-artifact-cleanup-protocol-step-12--after-delivery-commit). `status: completed` unless `fullMode`. | `step-12-{slug}.result.md` + benchmark |
| 13 | `fullMode` only. Gate → `Task`/`Shell` `11-ship-pr`: push → PR → goal-fix-pr (5m, max 10) → merge. | PR URL, merge |

Post-mutating: merge files_touched → Step file log; backup preExistingDirty; checkpoint `before-step-{N+1}`.

### Step 12 gates & cleanup

**Order:** Delivery Result Protocol → G2-delivery commit → MEMORY.md sweep → cleanup gate → §Doc → push consent (Step 13 gate when `fullMode`).

**MEMORY.md sweep (mandatory, before cleanup gate):** Run the [Inter-workflow Promotion (Step 12 Sweep)](#3-inter-workflow-promotion-step-12-sweep) protocol under [Learning & Memory Protocol](#learning--memory-protocol).

**G2-delivery:** **Commit plan and result** (rec) — stage `{slug}.plan.md` + `{slug}.result.md` only.

**Gate 1:** **Consolidate docs + clean temps** (rec) / **Docs only** / **Skip**.

**Gate 2 §Doc:** **Update now** / **Skip**.

**Cleanup:** Gate 1 opt-in; never on pause. Follows [Cleanup Protocol](#optional-artifact-cleanup-protocol-step-12--after-delivery-commit): delete `.plan.exec.md`, `.exec.dag.json`, worktrees, git tags (`uswf/*`), baseline, archive. Never `{slug}.plan.md`, `{slug}.result.md`, `{workflow-id}.state.md` while active.

Push consent: **Do not push now** — tags never pushed.

### Step 13 — Ship & PR (`fullMode` only)

After Step 12, orch presents ship gate.

**Gate (normal):** **Create PR, monitor, merge** (rec) / **Push only** / **Skip**. Auto: option 0. Dry-run: simulate.

**Pipeline (Create PR + monitor):**
1. `git push -u origin {branch}` (skip if pushed).
2. `gh pr create --head {branch} --base {baseBranch}`. Reuse open PR.
3. Dispatch `11-ship-pr` ([SKILL.md](../11-ship-pr/SKILL.md)): 300s initial wait → heartbeat: fetch → fix-pr if `activeThreads>0` → commit → resolve → push → 120s wait. Max 10 iterations. Convergence → `gh pr checks --watch` → `gh pr merge --merge`. Never `--delete-branch` with head=`develop`.
4. Auto: auto-selects merge, skill auto-gates per `09-goal-fix-pr`.

**Output:** `step-output` with `pr: {number, url, state}`, `goalFixPr: {iterations, max, activeThreadsRemaining, merged}`.

Stop: max exhausted · merge blocked · cancelled · PR closed.

---

## Error policy

Retry: max 3; backoff 0s→30s→60s. Revert: Checkpoint Algorithm only. Conduct: 4/8 no Task; orch never implements code; fresh Task/step; max 1 worktree; G2-code steps 7/10/11; G2-delivery step 12; HS-2a blocks plan-dir commits mid-workflow.

## Post-workflow (outside this agent)

Manual QA after workflow completion (or pause before Step 12) not resumed here. Use [`10-update-plan-implementation`](../10-update-plan-implementation/SKILL.md) (`/step-10`) — append plan §9, implement delta, update `{slug}.result.md`, certify for PR. Distinct from Step 10 (in-pipeline review fixes).

## Triggers

```
@[spec-to-pr] [auto|dry-run|skip-integration|skip-tests|full] [--model {name}] [--model-chain step:model,...] [US {issue_id} | {org}/{project}#{id} | {name}.spec.md | "feature description"]
/spec-to-pr [flags] [US {issue_id} | {org}/{project}#{id} | {name}.spec.md | "feature description"]
/status | progress | where am I? → Progress Board only
go back | change plan | back to step X → Backward Nav (not in auto)
switch model | change model → mid-workflow model switch (normal mode only — every transition gate)
```

**Model flags:**

| Flag | Argument | Effect |
|------|----------|--------|
| `--model` | `{name}` | Set `currentModel` at start. Overrides default. |
| `--model-chain` | `{step}:{model},{step}:{model},...` | Pre-specify per-step models. Orch auto-switches at boundaries. Overrides `--model`. Example: `--model-chain 5:sonnet-4,9:gemini-3-pro,10:sonnet-4` |

`--model-chain` is only way to switch models in **auto mode**. Normal mode: switch at any transition gate via **Switch model and advance**. Step with no mapping → current model persists.

If invoked **without** US number, spec path, or description:
> **Give me a GitHub issue id, an Azure DevOps work item (`ADO {id}` or `{org}/{project}#{id}`), a path to a hand-written `*.spec.md`, or a free-text feature description to start.**

Examples:
- `/spec-to-pr auto skip-tests skip-integration US 1234`
- `/spec-to-pr --model sonnet-4 "Implement a product analytics dashboard with real-time charts"`
- `/spec-to-pr auto contoso/project#5678`
- `/spec-to-pr ADO 2416`
- `/spec-to-pr specs/my-feature.spec.md`
- `/spec-to-pr full US 99`
- `/spec-to-pr auto --model-chain 5:sonnet-4,9:gemini-3-pro,10:sonnet-4 US 1234`
- `/spec-to-pr --model sonnet-4 auto skip-tests US 567`
