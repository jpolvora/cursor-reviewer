---
name: spec-to-pr-lite
description: >-
  Spec-to-PR lite delivery orchestrator FSM. Runs a fast, sequential planning-to-review pipeline.
  Invoke: /spec-to-pr-lite | @[spec-to-pr-lite]. Entry: GitHub issue | Azure DevOps work item | *.spec.md.
  Flags: dry-run, auto, skip-tests, full, --model, --model-chain. Delegates via Task tool.
upstream: jpolvora/workflow-skills — this skill is a workflow owned by workflow-skills. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
---

# Spec-to-PR Lite — Orchestrator

Deterministic FSM for sequential plan-to-ship delivery. Reuses existing pipeline skills.

## Core Goals
1. **Faster Turnaround:** Skip specification brainstorm (Step 0), refinement/interview (Step 2), and DAG decomposition (Step 3).
2. **Safety & Gates:** Enforce transition gates, code review validations, and optional shipping approval to maintain high quality.
3. **Portability:** Keep the orchestrator FSM configuration-driven, resolving all metadata and verification commands dynamically from `config.json`.

## Invariants

- **Entry Requirement:** Unlike standard `spec-to-pr`, `spec-to-pr-lite` **requires** an existing specification (GitHub issue ID, ADO work item ID, or path to a local `*.spec.md`) at invocation. Free-text brainstorm entry is not supported.
- **Workflow directory:** `{us-dir}` = `{config.plans.dir}/{slug}/` (default `.cursor/plans/{slug}/`).
- **State hygiene:** Run `python .agents/skills/spec-to-pr-lite/scripts/update_state.py` after every step to update progress and telemetry.
- **Workflow artifacts commit:** Stage only code during implementation/fix steps. Plan (`step-01-*.plan.md`) and result (`step-12-*.result.md`) documents are committed only at Step 4 (Consolidation) via the G2-delivery gate.

---

## Steps 1–5 Index

| Step | Label | Task? | `subagent_type` | Worktree | RO |
|------|-------|-------|-----------------|----------|-----|
| 1 | Planning and Brainstorm | ✓ | GP | — | — |
| 2 | Implementation | ✓ | GP | step-2‡ | — |
| 3 | Code Review & Fix | ✓ | GP | — | — |
| 4 | Consolidation & Delivery | ✓ | shell | cleanup | — |
| 5 | Ship & PR (optional ask) | ✓ | GP+shell | — | — |

‡ Worktree fallback rules apply. GP = `generalPurpose`.

---

## FSM Step Instructions

### Step 1: Planning and Brainstorm
- **Goal:** Draft the initial implementation plan from the existing specification.
- **Action:** Dispatch `Task` executing `01-write-plan` with the provided spec input argument.
- **Output:** `step-01-{slug}.plan.md`.

### Step 2: Implementation
- **Goal:** Sequential implementation of the plan drafted in Step 1.
- **Action:** Dispatch `Task` executing `04-implement-tasks` in `mode=build` using `step-01-{slug}.plan.md` as the target plan.
- **Validation:** Run backend/frontend verification commands (build and tests unless `skipTests: true`).

### Step 3: Code Review & Fix
- **Goal:** Local code review of changes introduced during Step 2.
- **Action:** Dispatch `Task` executing `06-code-review` comparing current workspace against the base branch.
- **Review Loop:**
  - If critical or warning findings exist:
    - Present findings to the user.
    - Ask Question: **Apply fixes now** / **Proceed without fixing** / **Pause**.
    - If "Apply fixes": dispatch `04-implement-tasks` in `mode=fix` with the findings, verify build/tests, and repeat Step 3.
  - If no findings or if user chooses to proceed: advance to Step 4.

### Step 4: Consolidation & Delivery
- **Goal:** Consolidate work outputs, capture telemetry, and commit delivery files.
- **Action:**
  1. Update checklist checkmarks in `step-01-{slug}.plan.md` to `[x]`.
  2. Write `{us-dir}/step-12-{slug}.result.md` summarizing the changes, files touched, and timing/token telemetry.
  3. **G2-delivery gate** (AskQuestion): **Commit plan and result** (rec) / **Skip commit** / **Pause**.
  4. If approved: stage `step-01-{slug}.plan.md` and `step-12-{slug}.result.md` and commit: `docs({slug}): delivery plan and result`.
  5. Run self-learning memory sweep: create unique markdown files in `.agents/skills/shared/self-learning/memory/` for new traps and run the compiler script: `python .agents/skills/shared/self-learning/self_learning.py --compile`.
  6. Present the optional cleanup gate (delete temporary artifacts, checkpoints, worktrees).
  7. Advance to Step 5.

### Step 5: Ship & PR (Optional Ask)
- **Goal:** Push changes, open a Pull Request on the remote repository, and merge.
- **Action:**
  1. Ask Question: **Create PR, monitor and merge** (rec) / **Push only** / **Skip shipping** / **Pause**.
  2. If approved: dispatch `11-ship-pr` to run pre-PR validation, push branch, create PR via provider, resolve review threads in a loop, and complete the merge.

---

## AskQuestion Gate Mappings (Auto-gate Choices)

In `autoMode` or when fallback menus are needed, use the following default choices:
- **Step 1 gate:** Advance to Step 2.
- **Step 2 gate:** Advance to Step 3.
- **Step 3 gate (review findings):** Choose **Proceed without fixing** (if errors persist) or auto-fix once.
- **Step 4 gate (delivery):** Commit plan and result. Keep all artifacts on disk (no cleanup).
- **Step 5 gate (ship):** Skip shipping / Do not push now (unless `fullMode` is active, in which case run full ship-pr).

---

## Triggers

```
@[spec-to-pr-lite] [auto|dry-run|skip-tests|full] [--model {name}] [--model-chain step:model,...] [US {issue_id} | {org}/{project}#{id} | {name}.spec.md]
/spec-to-pr-lite [flags] [US {issue_id} | {org}/{project}#{id} | {name}.spec.md]
```
