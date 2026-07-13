---
name: 07-integration-validation
description: Plans and executes pre-PR integration test batteries, verifying backend, database, RBAC, tenancy, and UI interfaces.
upstream: jpolvora/workflow-skills — this skill is a spec-to-pr pipeline dependency. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 2.1
disable-model-invocation: true
---

# 07-integration-validation

Responsible for planning and executing a pre-PR integration test suite. It serves as the final safety net to check backend endpoints, database migration status, multi-tenancy isolation rules, and user interfaces before branch updates are pushed.

---

## Invocation

### Standalone Mode

```
/integration-validation <plan-path> [spec=<spec-path>] [skip-browser]
```

### Workflow Mode (Step 11 of spec-to-pr)

Dispatched by `spec-to-pr` at Step 11. Receives `planPath` and `specPath` from the orchestrator state. UI browser testing requires explicit authorization.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `<plan-path>` | String | (required) | Path to refined plan (`step-02-*.plan.refined.md`) or draft plan (`step-01-*.plan.md`). |
| `spec=<spec-path>` | String | (optional) | Path to `step-00-*.spec.md`. Inferred from folder if omitted. |
| `skip-browser` | Flag | `false` | Skip browser-agent/UI testing and only run backend/API tests. |

---

## Prerequisites

Check the following before starting the integration tests:
- `config.json` — resolves local dev server URLs (e.g. `apiHost`, `devHost`), locales list, and DB seed keys.
- Ensure the codebase builds cleanly (backend + frontend).
- Confirm database migrations have been successfully applied.

---

## Phase 1 — Integration Test Plan

Generate `step-11-{slug}.integration-test.plan.md` containing:
1. **Target Hosts & Ports:** Resolves URLs and credentials using stack settings.
2. **Database State & Seeding:** Minimum seed datasets required per AC, and database rollback actions.
3. **API Contracts:** Expected HTTP status codes, Bearer JWT authorization headers, and error shapes.
4. **RBAC & Tenancy Isolation:** Matrix checking access control across roles, and data segregation filters.
5. **UI & Browser Paths:** Route destinations, form fields, and translation checks.
6. **Defect Thresholds:** Test case pass/fail metrics.

---

## Phase 2 — Execution & Reporting

1. **Verify Base Build:** Execute build and core test commands from `config.json.verification`.
2. **Apply Database Seeds:** Verify seed constraints and cleanups.
3. **Run API Checks:** Probe endpoints using `curl` or script runners.
4. **UI Validation:** Run browser automation or visual checks unless `skip-browser` is active.
5. **Report Output:** Write the results to `step-11-{slug}.integration-test.report.md`.

---

## Outputs

- **Plan:** `step-11-{slug}.integration-test.plan.md`
- **Report:** `step-11-{slug}.integration-test.report.md`

---

## Rules of Engagement

- **No Code Fixes:** This skill does not make code edits. If verification checks fail, report the gaps and transition back to [04-implement-tasks (fix mode)](../04-implement-tasks/SKILL.md).
- **A11y & Contrast:** Verify form validation errors and alert indicators are visible and high-contrast.
