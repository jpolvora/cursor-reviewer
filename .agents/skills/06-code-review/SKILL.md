---
name: 06-code-review
description: Senior code reviewer — two-phase triage and investigation with defect class generalization. Standalone or workflow Step 9.
upstream: jpolvora/workflow-skills — this skill is a spec-to-pr pipeline dependency. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 3.1
disable-model-invocation: true
---

# 06-code-review

Responsible for performing a comprehensive local code review on all modified files (relative to the base branch) before a PR is raised. It is the primary quality gate in the `spec-to-pr` pipeline but is equally effective when called directly by a developer after making changes.

---

## Invocation

### Standalone Mode

```
/code-review [base=<ref>] [plan=<plan-path>]
```

### Workflow Mode (Step 9)

Dispatched automatically by `spec-to-pr` at Step 9. Receives `base` and `planPath` from the orchestrator's state file.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `base` | String | `origin/main` or `origin/master` (auto-detected) | The git ref to diff against. |
| `plan` | String | (optional) | Path to `step-02-*.plan.refined.md` or `step-01-*.plan.md` to cross-reference the planned changes against reviewed code. |

---

## Execution Flow

### Phase 0 — Stack Detection

Read `config.json.stack` to determine which source layers are in scope:
- **Backend:** layered directories (Domain, Application, Infrastructure, API)
- **Frontend:** `sourceDir` for TypeScript/React
- **Ignored:** `bin/`, `obj/`, `dist/`, `node_modules/`, CI YAML, translations

Run the diff:
```bash
git diff --name-status {base}...HEAD -- ':!**/bin/**' ':!**/obj/**' ':!**/node_modules/**' ':!**/dist/**'
```

### Phase 1 — Triage (Hypothesis List)

Walk each modified file within scope and flag lines with real defect potential. Discard:
- Cosmetic formatting or naming nits
- Pre-existing code untouched by the current diff
- Low-risk TSX without security surface

### Phase 2 — Investigation (4-Step Proof)

For each triage hypothesis, complete **all four** steps before including in the report:
1. **Evidence Read:** list files, symbols, and callers inspected
2. **Failure Scenario:** specify exact inputs or state transitions that cause the issue
3. **Missing Protection:** explain why existing validations/tests do not prevent the failure
4. **Discards:** rejected alternative explanations

If all 4 steps cannot be completed → discard the hypothesis.

### Phase 2.5 — Defect Class Generalization

For each proven finding, search for sibling occurrences of the same pattern in the full diff (not just the file where it was first spotted). Report all occurrences together under one finding.

### Phase 2.6 — MEMORY.md Pattern Sweep

Run `grep` for each ID in `MEMORY.md → ## Review Patterns` against the modified file set. Report confirmed violations.

### Phase 2.7 — Invariant Checklists

Cross-check `config.json.invariants` and `config.json.rules`:

| Checklist | What to look for |
|-----------|------------------|
| Tenancy | `config.json.domain.tenancyField` — filters and documented exceptions |
| DB Migrations | `config.json.invariants.migrationsCliOnly` — no hand-written migration files |
| Domain Rules | Rules in `config.json.domain.model` |
| React Hooks | `useEffect` — cleanup presence and stable dependency arrays |
| i18n Keys | New translation keys present in all locales from `config.json.stack.frontend.i18n.locales[]` |

---

## Report Format

**If nothing to report:** output `No feedback` and stop.

**If findings exist:**

```markdown
## Code Review

**Branch:** `{branch-name}`
**Stack:** `{detected via config.json}`
**Files:** N

### Critical
- **`path:L42`**: CRITICAL — description (Score: 9/10)
  Analysis: (4 steps completed)
  Sibling occurrences: `path:L88`
  Suggestion: ```suggestion … ```

### Warning
- **`path:L80`**: WARNING — description (Score: 7/10)

### Suggestion
- **`path:L150`**: SUGGESTION — description (Score: 6/10)

---
**Apply fixes?** (YES → run build and tests)
```

---

## Automatic Fix (after YES)

1. Apply all surgical fixes to source files.
2. Run `build-backend`, `test-backend`, and `build-frontend` (+ `test-frontend` if UI logic is touched).
3. Report resulting files changed and test outcome.

---

## Rules of Engagement

- **Precision before volume:** only include findings with complete evidence. No speculative comments.
- **Convergence goal:** a single report round covering all issues simultaneously — avoid review loops.
- **Do not commit:** changes are staged to the working tree; the orchestrator or developer handles staging.
