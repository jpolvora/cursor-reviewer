---
name: check-workflows
description: Auto-check workflow processes (spec-to-pr & spec-to-pr-lite) for step continuity, config sharing, state isolation, compatibility, and provider references. Use when validating orchestrators, adding steps, or testing workflow changes.
upstream: jpolvora/workflow-skills — this skill is a harness validation skill. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 1.0
disable-model-invocation: true
---

# check-workflows

Utility skill designed to analyze, validate, and verify the structural integrity of both the standard `spec-to-pr` and the sequential `spec-to-pr-lite` workflow orchestrator files (`SKILL.md`, `setup.md`, and helper scripts).

---

## Quick start

To run the automated validation script against both workflows in the current repository:

```bash
python .agents/skills/check-workflows/scripts/check_workflows.py
```

---

## Validation Scope

The validation process evaluates the following areas:

### 1. FSM Step Continuity
- **Step indexes**: Asserts that all steps in the FSM tables (steps 0–13 in `spec-to-pr`, steps 1–5 in `spec-to-pr-lite`) map sequentially without duplicates or missing levels.
- **Linked skills**: Verifies that every step maps to a valid and existing dependency skill under `.agents/skills/` (e.g. `01-write-plan`, `04-implement-tasks`).

### 2. Config Path Integrity
- Ensures that both workflow orchestrators (`spec-to-pr`, `spec-to-pr-lite`) and SCM providers reference `shared/config.json` as the single canonical config location.
- Verifies that no script or skill contains legacy references to `spec-to-pr/config.json` or `spec-to-pr-lite/config.json` as the primary config path.
- There is no fallback — `shared/config.json` is the only valid runtime config location.

### 3. State Isolation & Schema
- Checks that `update_state.py` and state schemas enforce the `workflowType` field (`standard` vs `lite`) to ensure runtime state isolation.
- Verifies that the resume/reset discovery scripts filter files using this field.

### 4. Provider Reference Resolution
- Asserts that local spec provider and SCM provider scripts resolve configuration locations cleanly from either standard or lite folders.

---

## Verification Automation

The validation logic is encoded in the Python script located at `scripts/check_workflows.py`. It reads the markdown files, parses their tables, and scans script files for potential coupling or path drift.

See [scripts/check_workflows.py](file:///.agents/skills/check-workflows/scripts/check_workflows.py) for the complete linting assertions.
