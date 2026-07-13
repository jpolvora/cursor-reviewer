---
name: 04-implement-tasks
description: Executes code implementations or fixes defects following a plan, DAG, or code review findings.
upstream: jpolvora/workflow-skills — this skill is a spec-to-pr pipeline dependency. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 2.1
disable-model-invocation: true
---

# 04-implement-tasks

Responsible for executing the coding and testing steps defined in the plan or fixing defects identified during code reviews. It operates in two modes:
- **Build Mode:** Implements new features following `step-03-{slug}.plan.exec.md` (or the step-by-step plan in `step-02-{slug}.plan.refined.md` / `step-01-{slug}.plan.md` directly).
- **Fix Mode:** Systematically corrects code review comments or test failures.

---

## Invocation

### Standalone Mode

```
/implement-tasks <plan-path> [mode=build|fix] [findings=<path>]
```

### Workflow Mode (Step 5 for build / Step 10 for fix in spec-to-pr)

Dispatched by `spec-to-pr` at Step 5 (build mode) or Step 10 (fix mode). Receives `planPath`, `mode`, and optional `findings` path from the orchestrator state.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `<plan-path>` | String | (required) | Path to execution plan (`step-03-*.plan.exec.md`), refined plan (`step-02-*.plan.refined.md`), or draft plan (`step-01-*.plan.md`). |
| `mode` | String | `build` | Execution mode: `build` or `fix`. |
| `findings` | String | (optional) | Path to findings report or review comments JSON. |

---

## 1. Build Mode Execution

1. **Load Plan:** Parse the execution tasks or plan steps. Identify files to create/modify and their acceptance criteria.
2. **Scan Codebase:** Locate similar patterns in the project layers defined in `config.json` to ensure style consistency.
3. **Implement:** Write minimal, clean, and modular code matching the requirements. Avoid scope creep.
4. **Validate:** Execute the build and unit tests for modified layers (backend/frontend).
5. **Report:** Return the lists of modified/created files and test output details.

---

## 2. Fix Mode Execution

1. **Intake Gaps:** Load the list of findings (e.g. `step-10-*.report.md` or review comment threads).
2. **Surgical Corrections:** Apply minimal, targeted corrections following Karpathy guidelines.
3. **Global Sweeping:** Search for sibling occurrences of the same defect class across modified directories. Fix them simultaneously.
4. **Anti-Regression:** Write unit tests to cover the corrected defect scenario.
5. **Validate:** Execute project builds and test suites to verify no regressions were introduced.

---

## Output (Both Modes)

- **Workspace:** Modify files directly in the working tree. Do not commit or push.
- **Summary:** List modified/created files, passing/failing tests, and fixed findings.

### step-output (Workflow Mode)

```yaml
status: success | partial | failed | needs_user
files_touched:
  created: []
  modified: []
  deleted: []
verification:
  files_on_disk: pass | fail
  build: pass | fail | skipped
  tests: pass | fail | skipped
summary: |
  (Summary text of changes and verifications)
```

---

## Rules of Engagement

- **No Auto-Commits:** Never commit or push code. Let the orchestrator or user handle branch staging and commits.
- **Strict Scope Isolation:** Do not refactor adjacent files or expand feature scopes.
- **Migration Safety:** Never write database schema migration files by hand. Always use project CLI tools.
