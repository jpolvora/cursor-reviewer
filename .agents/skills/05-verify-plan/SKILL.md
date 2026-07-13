---
name: 05-verify-plan
description: Compares implementation quality and code deliverables against the plan and acceptance criteria.
upstream: jpolvora/workflow-skills — this skill is a spec-to-pr pipeline dependency. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 2.1
disable-model-invocation: true
---

# 05-verify-plan

Responsible for auditing implementation deliverables against the specification and design blueprints. It runs in two modes:
- **Quick Score Mode:** Evaluates overall code quality, conventions, and test coverage on a 0-10 scale.
- **US Verification Mode:** Audits precise adherence between the spec (`step-00-{slug}.spec.md`), the plan (`step-02-{slug}.plan.refined.md` or `step-01-{slug}.plan.md`), and the actual code, generating a feature-by-feature report.

---

## Invocation

### Standalone Mode

```
/verify-plan [spec-input] [plan-dir=<path>]
```

### Workflow Mode (Step 6 of spec-to-pr)

Dispatched by `spec-to-pr` at Step 6. Receives `specPath` and `planDir` from the orchestrator state. Returns `step-output` YAML at completion.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `spec-input` | String | (optional) | Path to `step-00-*.spec.md`, US number (e.g. `1474`), or omitted to trigger Quick Score mode. |
| `plan-dir=<path>` | String | `.cursor/plans/{slug}/` | Directory containing the plans and output report. |

---

## 1. Quick Score Mode (Without Spec)

When no specification is provided, evaluate the overall code status against the local plan and modified files:

### Evaluation Metrics

| Metric | Weight | Check Details |
|--------|--------|---------------|
| **Completeness** | 40% | Were all planned files and deliverables implemented? |
| **Correctness & Style** | 35% | Does the code respect project layer boundaries, multi-tenancy, and standards? |
| **Tests** | 25% | Were tests updated and do they execute successfully? |

Assign a 0-10 score to each metric. Approve the implementation if the weighted average score is `≥ 7`, otherwise suggest re-implementation.

---

## 2. US Verification Mode (Full Workflow)

Audits adherence between the canonical spec (`step-00-*.spec.md`), the plan (`step-02-*.plan.refined.md` or `step-01-*.plan.md`), and the modified code.

### Plan Resolution Order
Search the plan directory (`.cursor/plans/{slug}/`) in the following order:
1. `step-02-{slug}.plan.refined.md` (refined plan, primary)
2. `step-01-{slug}.plan.md` (initial plan, fallback)

---

## Output Report Format

Write the validation report to `{plan-dir}/step-06-{slug}.plan.report.md`. The report must match the following format exactly:

```markdown
---
us: "{slug}"
reportDate: YYYY-MM-DD
sourcePlans: ["step-02-{slug}.plan.refined.md"]
githubSource: gh | none
---

# Implementation Report — {slug}

**Generated on:** YYYY-MM-DD
**Reference Plan:** step-02-{slug}.plan.refined.md (or step-01-{slug}.plan.md)

## Result by Feature (Plan & ACs)

| Feature | Situation | Detail / Evidence |
|---------|-----------|-------------------|
| CRUD Accounts | **Implemented** | `AccountService.cs:L20-L45` |
| Tenancy Check | **Implemented differently** | Plan asked for filter X, implemented via ORM global filter Y. |
| List Sorting | **Not implemented** | Column headers are static; missing sorting logic. |

*Situation must be strictly one of: **Implemented**, **Not implemented**, or **Implemented differently**.*

## Additional Features Beyond Original Plan

| Feature / Extra Behavior | Location in Code | Note |
|--------------------------|------------------|------|
| (Optional extra) | `path:line` | (Contextual notes) |

## Gaps and Next Steps
- (List missing or incomplete tasks to resolve before PR approval)
```

---

## Rules of Engagement

- **Plan Immutability:** Do not edit the reference `*.plan.md` files. Write findings exclusively to the `step-06-{slug}.plan.report.md` file.
- **Accurate Evidence:** Always cite specific file paths and line numbers for implemented features.
