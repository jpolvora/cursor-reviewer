---
name: 02-interview
description: Audits and interrogates an implementation plan to resolve ambiguities and verify ready criteria before tasks are created.
upstream: jpolvora/workflow-skills — this skill is a spec-to-pr pipeline dependency. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 1.6
disable-model-invocation: true
---

# 02-interview (Plan Refinement & Grilling)

Responsible for auditing and interrogating the draft plan (`step-01-{slug}.plan.md`) against acceptance criteria, codebase structures, multi-tenancy rules, and invariants. It operates on a "grill-me" philosophy to resolve ambiguities and secure shared understanding before task decomposition begins.

---

## Invocation

### Standalone Mode

```
@[refine] <plan-path> [spec=<spec-path>]
```

### Workflow Mode

Dispatched by `spec-to-pr` at Step 2 (refinement). Discovers parameters via context and operates on step inputs.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `<plan-path>` | String | (required) | Path to `step-01-{slug}.plan.md`. |
| `spec=<spec-path>` | String | (optional) | Path to `step-00-{slug}.spec.md`. Inferred from the plan folder if omitted. |

---

## Grilling Protocol (Hard Rules)

1. **Diligent Exploration First:** Search the codebase, ADRs, database schema, and `MEMORY.md` before asking. If the answer is discoverable, resolve the gap automatically and record the evidence.
2. **Walk the Design Tree:** Resolve foundational gaps (scope/schema) before details (UI/i18n).
3. **Surgical Escalation:** Ask exactly **one** question per round. Include the recommended solution as the first choice.
4. **Escalation Cap:** Max **3 rounds** of user questions. On the 4th, apply sensible defaults and exit the loop.
5. **No Code Edits:** Do not modify product code or write tests. Only write refined plans and metadata.

---

## State Machine (FSM)

```
[Audit Plan] ──> [Resolve Gaps] ──> [Escalate / Ask] ──> [Shared Understanding]
```

### Phase 1 — Audit (Scan & Register)
- Audit sections 0–8 in `step-01-{slug}.plan.md`.
- Run scenario probes (e.g., Soft-deletion, concurrency, list sizing, rate limits).
- Register findings in a `gap_registry` with fields: `id`, `class`, `section`, `gap`, `recommendation`, `status`, `dependsOn`.
- Classify gaps as:
  - **blocking:** Prevents development or changes AC. Must be resolved or escalated.
  - **non-blocking:** Code quality, optimizations. Applied directly via defaults.

### Phase 2 — Resolve (Local Gaps)
- Resolve registered gaps by scanning code layers, specifications, and `MEMORY.md`.
- Append resolution evidence to the registry.

### Phase 3 — Escalate (Clarify Gaps)
- Standalone: prompt the user via `AskQuestion`.
- Workflow: return `status: needs_user` with details to allow the orchestrator to request feedback.

### Phase 4 — Shared Understanding
- The plan cannot be finalized until `shared_understanding: confirmed` (except under `autoMode`).
- STANDALONE: Prompt the user to confirm.
- WORKFLOW: Orchestrator handles the gate confirmation.

---

## Outputs

- Drafts `step-02-{slug}.plan.refined.md` (leaving `step-01-{slug}.plan.md` untouched).
- Appends the `## Interview registry` table to the bottom of the refined plan.
- Sets the frontmatter `status` to `"plan refined ok"`.

### step-output (Workflow Mode)

```yaml
status: success | needs_user
refine:
  registry: [{id, class, section, gap, status, resolution, dependsOn?}]
  round: number
  blocking_open: number
  shared_understanding: pending | confirmed
needs_user:
  question: string              # ONE question only
  options: [{id, label}]        # recommended choice first
  context: string
  design_branch: string         # e.g., "Authorization / tenant"
```
