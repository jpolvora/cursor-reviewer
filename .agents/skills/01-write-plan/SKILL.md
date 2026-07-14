---
name: 01-write-plan
description: Generates the initial implementation plan (step-01-{slug}.plan.md) from the specification.
upstream: jpolvora/workflow-skills — this skill is a spec-to-pr pipeline dependency. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 3.2
disable-model-invocation: true
---

# 01-write-plan

Responsible for loading the feature specification (whether a local spec, a GitHub issue, or an Azure DevOps work item) and drafting a detailed implementation blueprint. It reads the local stack configurations to remain stack-agnostic.

---

## Invocation

### Standalone Mode

```
/write-plan <spec-input> [slug=<slug>] [output-dir=<path>]
```

### Workflow Mode (Step 1 of spec-to-pr)

Dispatched by `spec-to-pr` at Step 1. Receives `specInput` (path or issue ID) from the orchestrator's state.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `<spec-input>` | String | (required) | Path to a local `step-00-*.spec.md`, GitHub issue ID (e.g. `GH 42`), or Azure DevOps ID (e.g. `US 101`). |
| `slug=<slug>` | String | (optional) | Unique url-friendly identifier. Inferred from spec if omitted. |
| `output-dir=<path>` | String | `.cursor/plans/{slug}/` | Destination folder for the drafted plan. |

---

## Prerequisites

Read the following repository metadata files before drafting:
- `config.json` — identifies stack, backend layers, db/ORM, frontend framework, and test suites.
- `tools.md` / `stack.md` — lists developer tool aliases and stack configurations.
- `MEMORY.md` — outlines anti-regression rules and learned patterns.

---

## Plan Template

Draft the structured plan and write it to `{output-dir}/step-01-{slug}.plan.md`. The plan must match the following format exactly:

```markdown
---
slug: {slug}
title: "{title}"
status: "plan to be refined"
---

## 0. Summary & Business Rules
- Feature number/title, core objectives, target business rules, and security mitigations.

## 1. Definition of Ready & Scope
- Resolved assumptions, measurable Acceptance Criteria (ACs), out-of-scope boundaries.

## 2. Technical Design & Architecture
- Layer edits (per config.json layers): backend files, database schema, entity mappings.
- Frontend edits: pages, routes, API endpoints, styling, and i18n keys.
- Verification of invariants from `config.json.invariants`.

## 3. Step-by-Step Plan
Steps ordered logically by dependency:
- Step 1: Domain & Database (migrations, schema additions, db entities).
- Step 2: Application Core (DTOs, service controllers, logic validations).
- Step 3: Backend Unit Tests (testing service rules and boundary validations).
- Step 4: Frontend & UI (components, API integrations, page layouts).
- Step 5: Frontend Tests (testing UI components and workflows).

*For each step, specify: Action details · Affected files · Engineering checks.*

## 4. Permissions, Tenancy & i18n
- RBAC permissions, tenant data leakage isolation checks, and dynamic i18n strings.

## 5. Test Coverage
- Map each Acceptance Criteria (AC1, AC2, etc.) to specific test cases and method names.

## 6. Invariants (Do Not Violate)
- Reiterate strict architectural invariants from `config.json.invariants`.

## 7. Pre-PR Checklist
- [ ] Layer boundaries respected.
- [ ] Mappings and domain entities encapsulated.
- [ ] Schema migrations created.
- [ ] Authorization checks applied.
- [ ] i18n keys declared.
- [ ] Test cases cover all ACs.

## 8. Open Questions
- Ambiguities, blocked tasks, or architectural decisions requiring reviewer input.
```

---

## Rules of Engagement

- The plan must contain sufficient detail for direct coding task generation.
- **Do not write product code:** this skill is strictly for planning and documentation.
- If the project stack cannot be detected from `config.json`, stop and ask for clarification.
