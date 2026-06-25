---
name: us-delivery-workflow
description: Orchestrates end-to-end User Story delivery. Supports 7 phases (F0-F6) and steps 0-12. Features dry-run, automatic mode, authorization gates, grilling FSM, worktree fallback on Windows, and State Hygiene Protocol. Generic and adaptable to any project stack.
disable-model-invocation: true
version: 8.0
---

# US Delivery Workflow (Generalized)

Orchestrator for **end-to-end delivery** of a User Story or feature in any repository. 

> **v8.0:** Fully generalized. Autodetects project stack (C#/.NET, Angular/React/Node, Python, Go, etc.), adapts build/test validation commands, uses local config for ADO/Github, and runs with self-contained scripts under the skill's own `scripts/` directory.

- **Out of scope:** Opening/updating Pull Request, `fix-pr`, merge review — manual by the user **after Step 12** (push consent gate). Auto-push to remote is never performed.
- **Language:** Skill in English; orchestrator **user-facing messages in pt-BR**.
- **Enforced authorization (critical):** No commit, push, or mutating step runs without explicit authorization (except `autoMode`). The orchestrator obeys the **Authorization Ladder** and its **hard stops** — a skipped/cancelled `AskQuestion` is **never** inferred as "yes". See **Authorization Ladder Protocol**.
- **Step isolation:** Every Task-dispatching step uses a **fresh, step-specific subagent**, the checkpoint **anchor tag** `uswf/{id}/before-step-{N}`, and — only when the step mutates `src/` or `app/` — a **dedicated git worktree** for that step **when stable**, otherwise a **branch-direct fallback**. See **Step Dispatch & Isolation Protocol** and **Worktree Fallback Protocol**.
- **State as source of truth:** After every step the orchestrator runs the **State Hygiene Protocol** (sync `## Step file log`, manifest, `completedSteps`, dispatches, commits) and asserts file/commit existence **before** rendering the Progress Board. Failure $\rightarrow$ **HS-5** (stop). Checker script: `.agents/skills/us-delivery-workflow/scripts/validate_state.py`.
- **Dry-run mode:** Triggered via `dry-run`, `simular`, etc. Set `dryRun: true` in state. Simulates steps 5, 7, 10, 11 without side effects (no code edits, commits, push, browser automation, worktrees, or MEMORY.md updates). Prefix user-facing messages with `[DRY-RUN]`. Step 11 **never** runs browser/MCP.
- **Automatic mode:** Triggered via `auto`, `automatico`, or `automático`. Set `autoMode: true` in state. The orchestrator **never** presents `AskQuestion` gates — it always selects the **recommended (first) option** at every decision point and immediately dispatches the next step. Combines with dry-run. Prefix messages with `[AUTO]`. Hard stops HS-3/HS-4/HS-5 still apply.
- **Skip-integration flag:** Triggered via `skip-integration` (or `pular-integracao`). Set `skipIntegration: true` in state. **Step 11 is skipped entirely** — no integration test-plan generation, no execution, no browser.
- **Skip-tests flag:** Triggered via `skip-tests` (or `pular-testes`). Set `skipTests: true` in state. Automated **test-suite execution is skipped** (e.g. `dotnet test` / `npm test`) in build/test validations (Steps 7, 10, 11) — compilation/build (e.g. `dotnet build` / `npm run build`) **still runs** so commits are never made on a broken build.
- **Safe revert scope:** Any undo/reset/revert/backward-navigation must touch **only** files and git changes **attributed to this workflow**. Pre-existing dirty files must **never** be reverted.

---

## Allowed Dependencies

This skill is **self-contained**. Use only:
- This file: `.agents/skills/us-delivery-workflow/SKILL.md`
- Local scripts: 
  - `.agents/skills/us-delivery-workflow/scripts/check_memory_conflict.py`
  - `.agents/skills/us-delivery-workflow/scripts/validate_state.py`
  - `.agents/skills/us-delivery-workflow/scripts/get-wi-with-children.ps1`
- Project rules: `AGENTS.md` and rules under `.cursor/rules/` of the target project
- Shared state: `.cursor/plans/us-{id}/{workflow-id}.state.md` under the per-US working folder
- Knowledge base: `MEMORY.md` at the **repo root**
- **Code review skill (Step 9 review engine):** `.agents/skills/code-review/SKILL.md`

---

## Working Folder Convention

**All** workflow files live under a single per-US working folder:
- **Working folder (`{us-dir}`):** `.cursor/plans/us-{id}/` (or `.cursor/plans/{slug}/` if no US ID).
- **State:** `{us-dir}/{workflow-id}.state.md`
- **Artifacts:** all under `{us-dir}/` (`us-{id}.ado.md`, `us-{id}.plan.md`, `us-{id}.plan.exec.md`, `us-{id}.exec.dag.json`, `us-{id}.plan.report.md`, `us-{id}.report.md`, `us-{id}.integration-test.plan.md`, `us-{id}.integration-test.report.md`).
- **Internals (git-ignored):** `{us-dir}/worktrees/step-{N}/` and `{us-dir}/{workflow-id}.baseline/`.

---

## Phase Architecture

The pipeline is presented to the user as **7 phases (F0–F6)**, while `state.md` tracks **step IDs 0–12 internally** for checkpoints, revert, and resume.

| Fase | Nome | Steps | Executor principal |
|------|------|-------|--------------------|
| **F0** | Bootstrap | 0 | Orchestrator |
| **F1** | Especificação | 1, 2, 3 | Subagent (Planner) |
| **F2** | Implementação | 4†, 5 | Subagent (Coder) |
| **F3** | Verificação e 1º commit | 6, 7 | Subagent (Verifier) + Orchestrator |
| **F4** | Review e correções | 8†, 9, 10 | Subagent (Reviewer + Coder) |
| **F5** | Integração pré-PR | 11 | Subagent (Verifier) + browser opcional |
| **F6** | Fechamento | 12 | Orchestrator + shell |

† **Steps 4 and 8 are Model Readiness Sub-gates** at transitions F1$\rightarrow$F2 and F3$\rightarrow$F4. They never appear in `completedSteps` and are logged in `## Gate history` as `model-gate`.

---

## Step & Dispatch Index

| Step | Name | Executor | Task? | Subagent | Worktree? | Model Hint | Readonly? |
|------|------|----------|-------|----------|-----------|------------|-----------|
| 0 | Inicialização do Workflow | Orchestrator | No | — | — | — | — |
| 1 | Planejamento e Brainstorm | Subagent | Yes | `generalPurpose` | — | Planner | false |
| 2 | Refinamento e Grilling | Subagent | Yes | `generalPurpose` | — | Planner | false |
| 3 | Plano de Execução e DAG | Subagent | Yes | `generalPurpose` | — | Planner | false |
| 4† | Preparação para Codificação | **Sub-gate (F1$\rightarrow$F2)** | No | — | — | User swaps to Coder | — |
| 5 | Implementação (DAG) | Subagent | Yes | `generalPurpose` | `step-5` | Coder | false |
| 6 | Verificação e Relatório | Subagent | Yes | `generalPurpose` | — | Verifier | true |
| 7 | Decisão e 1º Commit | Orchestrator + subagent + shell | Yes | `generalPurpose` + `shell` | — | Coder / Shell | false |
| 8† | Preparação para Code Review | **Sub-gate (F3$\rightarrow$F4)** | No | — | — | User swaps to Reviewer | — |
| 9 | Code Review | Subagent | Yes | `generalPurpose` | — | Reviewer | false |
| 10 | Correções, 2º Commit e Relatório | Subagent + shell | Yes | `generalPurpose` + `shell` | `step-10` | Coder / Shell | false |
| 11 | Validação de Integração e Pré-PR | Subagent + browser + shell | Yes | `generalPurpose` + `shell` | `step-11` | Verifier / Coder | false |
| 12 | Consolidação e Limpeza Final | Orchestrator + shell | Yes | `shell` | cleanup all | Shell / Light | false |

---

## Reusable Protocols

### 1. Authorization Ladder Protocol (Orchestrator — critical)
Prevent unauthorized side effects. Every operation maps to a level; mutating levels require an explicit gate:
- **G0 (Read):** Read code/ADO, generate reports. No gate.
- **G1 (Write working tree):** Edit files, generate plans, implement. Gate: Transition gate into the mutating step.
- **G2 (Commit):** `git commit`. Gate: Dedicated gate at Step 7 / Step 10 / Step 11.
- **G3 (Publish):** `git push`, open PR. Gate: Step 12 push consent (PR is manual).

**Hard stops (normal mode):**
- **HS-1:** AskQuestion skipped/cancelled $\rightarrow$ STOP. Re-present the gate.
- **HS-2:** G2 (commit) without explicit selection of the Step 7/10 menu $\rightarrow$ STOP.
- **HS-3:** A mutating-step subagent returns success with empty files_touched $\rightarrow$ FAILED.
- **HS-4:** Step 5 (or 10/11 code fix) success without the expected files present on state.branch $\rightarrow$ FAILED + offer retry.
- **HS-5:** State Hygiene assertion failed $\rightarrow$ STOP before Progress Board.

### 2. Transition Discipline Protocol (Orchestrator)
- **Normal mode:** Step N completes $\rightarrow$ run **State Hygiene** $\rightarrow$ create checkpoint `before-step-{N+1}` $\rightarrow$ render **Progress Board** $\rightarrow$ show summary $\rightarrow$ present **Transition Gate** (`AskQuestion`). Dispatch Step N+1 **only after** user selection.
- **Auto mode:** Auto-select recommended option and dispatch Step N+1 in the same turn.

### 3. Grilling FSM Protocol (Step 2 — investigative sub-loop)
- **2a Audit:** Subagent lists gaps in `gap_registry[]` + `## Grilling registry` in state.
- **2b Resolve:** Subagent closes gaps with evidence from code, docs, memory, or ADO.
- **2c Escalate:** Orchestrator presents `AskQuestion` (one question per round, max 3 rounds) with the option **Encerrar grilling e avançar** (recommended defaults apply).
- **2d Exit:** All gaps resolved OR remaining open gaps logged as `assumed-default` in state.

### 4. Worktree Fallback Protocol
- **Decision:** If `dryRun: true` $\rightarrow$ no worktree. If `OS == Windows`, worktree path length > 180 chars, or `git worktree add` fails $\rightarrow$ Mode: `branch-direct`. Otherwise $\rightarrow$ Mode: `step-worktree`.
- **branch-direct:** Edits happen directly on `state.branch`. Orchestrator verifies expected paths are dirty or committed at the end.
- **Post-step verification:** Check that files exist, `git diff` contains changed files, and compilation/build compiles cleanly.

### 5. State Hygiene Protocol (Orchestrator — after every step)
Run immediately after Step N completes. Any failed assertion $\rightarrow$ HS-5.
1. Append `## Step outputs` and merge `files_touched`.
2. Recompute aggregates, update `completedSteps` and `currentStep`.
3. Assert all files in `files_touched` exist on disk and `currentStep` matches the next gate.
4. Run `python .agents/skills/us-delivery-workflow/scripts/validate_state.py {workflow-id}` as a smoke check.

### 6. Model Readiness Sub-gates Protocol
Model checking is folded into the transition gates (F1$\rightarrow$F2 and F3$\rightarrow$F4). The user is prompted to swap models if needed, and the choice is logged as `model-gate` in `## Gate history`.

### 7. Step Dispatch & Isolation Protocol
- Launch a new `Task` subagent per step dispatch (never resume across steps).
- Set anchor tag `uswf/{workflow-id}/before-step-{N}` before dispatch and reference it in the prompt.
- Create step worktree if in `step-worktree` mode. Merge and remove worktree after step success.

### 8. Memory Consultation Protocol (start of EVERY step)
The executing subagent must read `MEMORY.md` at the repo root, scan the index, apply relevant **Patterns**, explicitly avoid **Traps**, and record applied entries in `step-output.learning`.

### 9. Context Loading Protocol (Steps 1, 2, 5)
Detect the repository stack. Read `AGENTS.md`, local rules under `.cursor/rules/`, and domain documents under `docs/`. Look for similar implementations in the codebase to mirror their style and patterns.

### 10. ADO Fetch Protocol (Steps 0, 2, 6)
Work items are retrieved only via:
```bash
pwsh .agents/skills/us-delivery-workflow/scripts/get-wi-with-children.ps1 -WorkItemId {us} -OutputPath .cursor/plans/us-{id}/us-{id}.ado.md
```
Read the saved snapshot instead of re-fetching in later steps.

### 11. Build & Test Validation Protocol (Steps 7, 10)
Autodetect compilation/test tools and run the appropriate commands:
1. Run compilation/build (e.g. `dotnet build`, `npm run build`, `go build`).
2. Run automated test suites (e.g. `dotnet test`, `npm test`, `pytest`, `go test`) unless `skipTests: true` is active (in which case test suites are skipped but build still runs).
3. If build/test fails, dispatch Coder subagent to fix it. Repeat loop until successful.

### 12. Integration Validation Protocol (Step 11)
- **skipIntegration: true:** Skip Step 11 entirely.
- **autoMode or dryRun:** Skip browser UI automation (never run `cursor-ide-browser` or browser MCP).
- **Execution:** Generate `.cursor/plans/us-{id}/us-{id}.integration-test.plan.md`, execute backend/API checks, and write the report.

### 13. Learning Protocol (Step 12)
Accumulate learnings in `step-output.learning` during steps 5/7/10/11. At Step 12, evaluate candidates against the write gate (generalizable, technical, not a duplicate, concise). Write valid entries to the top of `MEMORY.md` and update its index.

---

## Step Execution Guide

### Step 0: Inicialização do Workflow
Orchestrator bootstraps the state, autodetects stack, checks for active workflows, runs ADO Fetch to create the US snapshot, and creates the baseline git checkpoint.

### Step 1: Planejamento e Brainstorm
Subagent reads the ADO snapshot, local rules, and `MEMORY.md`. Drafts the implementation strategy in `us-{id}.plan.md` §0 (Summary) and §1 (Ready criteria/Scope).

### Step 2: Refinamento e Grilling (FSM)
Subagent audits the plan, registers gaps in §8, and runs the grilling loop with the orchestrator to resolve ambiguities. Patches `plan.md` and writes decisions to the state registry.

### Step 3: Plano de Execução e DAG
Subagent produces the detailed technical design by layer and writes the execution tasks as a Directed Acyclic Graph (DAG) in `us-{id}.plan.exec.md` and `us-{id}.exec.dag.json`.

### Step 5: Implementação (DAG)
Subagent executes the DAG tasks in order. Generates code, components, and tests inside the step worktree. Verifies build and registers all files touched.

### Step 6: Verificação e Relatório
Subagent performs a read-only validation of the implementation. Checks file structures and coverage against criteria. Writes `us-{id}.report.md`.

### Step 7: Decisão e 1º Commit
Orchestrator runs the Build & Test Validation. If successful, prompts for commit authorization (G2). Commits files with the message: `feat(us-{id}): [summary of changes]`.

### Step 9: Code Review
Subagent runs the local `code-review` skill (`.agents/skills/code-review/SKILL.md`) to check the implementation. Generates the review report in `plan.report.md`.

### Step 10: Correções, 2º Commit e Relatório
Subagent fixes review findings and generalized issues. Orchestrator runs Build & Test Validation, and commits corrections as `fix(us-{id}): code review adjustments`.

### Step 11: Validação de Integração e Pré-PR
Subagent creates the integration test plan, executes backend and API test batteries (and browser test cases if not skipped), and generates the validation report.

### Step 12: Consolidação e Limpeza Final
Orchestrator runs the Learning Protocol to write to `MEMORY.md`, cleans up all step worktrees/branches, and obtains manual push consent (G3).
