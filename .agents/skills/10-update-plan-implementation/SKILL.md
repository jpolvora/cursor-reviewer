---
name: 10-update-plan-implementation
description: Post-workflow delta adjustments. Captures manual QA findings, plans delta fixes, implements changes, and updates result summaries.
upstream: jpolvora/workflow-skills — this skill is a spec-to-pr pipeline dependency. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 1.1
disable-model-invocation: true
---

# 10-update-plan-implementation (Post-Workflow Fixes)

Responsible for capturing manual QA findings and implementing delta corrections after the main workflow finishes. It appends the delta plan (§9) to the finalized plan file and updates the delivery results document.

---

## Invocation

### Standalone Mode

```
/step-10 <slug-or-plan-path> [session-name=<name>]
```

### Workflow Mode (Post-workflow, on demand)

Not part of the main `spec-to-pr` pipeline. Invoked by the developer explicitly after completing the main workflow when manual QA or browser testing reveals additional gaps.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `<slug-or-plan-path>` | String | (required) | Feature identifier (e.g. `us-1234`) or relative path to the plan. |
| `session-name=<name>` | String | `step10-{timestamp}` | Unique session identifier for the transient log. |

---

## Prerequisites

Resolve the working directories and target artifacts:
- **Finalized Plan:** `step-02-{slug}.plan.refined.md` (if exists) or fallback `step-01-{slug}.plan.md`.
- **Delivery Result:** `step-12-{slug}.result.md`.

---

## State Machine (FSM) Flow

```
[Bootstrap] ──> [Intake Gaps] ──> [Delta Plan] ──> [Implement Gaps] ──> [Verify & Certify]
```

### Phase 1 — Bootstrap & Context Board
- Resolve the target `{slug}` and locate the plan files.
- Query all commits since the delivery checkpoint: `git log --oneline {base}..HEAD`.
- Display the **Context Board** in English: target slug, active branch, baseline hash, and list of commits.

### Phase 2 — Intake Gaps
- Capture findings from manual QA or browser tests in a structured intake table:

| Finding ID | Source | Severity | Description | Expected Behavior | Evidence |
|------------|--------|----------|-------------|-------------------|----------|
| `F-01` | manual QA | blocker | (Details of the gap) | (Expected output) | `path:line` |

### Phase 3 — Delta Plan
- Append **§9 Post-workflow follow-up** to the finalized plan file (`step-02-{slug}.plan.refined.md` if exists, otherwise `step-01`).
- Section 9 outlines: `session-id`, `triggered`, `after-workflow`, `branch`, list of `Findings` (F-01, F-02), `Delta implementation steps` (S-01, S-02), and a `Certification` checklist.

### Phase 4 — Implementation & Scoped Validation
- Apply minimal surgical fixes for each open step `S-NN`.
- Run validation checks (e.g. backend tests, frontend builds).
- Commit code fixes in small batches: `fix({slug}): post-workflow {F-01}`.

### Phase 5 — Verification & Certification
- Verify that every blocker finding is marked as resolved.
- Record commit hashes in the plan's §9 commits table.
- Update `step-12-{slug}.result.md` (append new fixes to the Done section).
- Present the **PR Readiness Summary** in English.
