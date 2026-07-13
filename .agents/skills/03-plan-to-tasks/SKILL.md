---
name: 03-plan-to-tasks
description: Breaks an implementation plan into atomic tasks with files, ACs, and coderPrompts, organized in a DAG topological order.
upstream: jpolvora/workflow-skills — this skill is a spec-to-pr pipeline dependency. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 2.1
disable-model-invocation: true
---

# 03-plan-to-tasks

Responsible for reading the finalized plan (`step-02-{slug}.plan.refined.md` or `step-01-{slug}.plan.md` if Step 2 was bypassed) and decomposing it into atomic tasks. It schedules tasks into a Directed Acyclic Graph (DAG) of parallelizable levels, or auto-detects if the plan is small enough to be run sequentially.

---

## Invocation

### Standalone Mode

```
/plan-to-tasks <plan-path> [thresholds=<path>]
```

### Workflow Mode (Step 3 of spec-to-pr)

Dispatched by `spec-to-pr` at Step 3. Receives `planPath` (path to `step-02-*.plan.refined.md` or `step-01-*.plan.md`) from the orchestrator state.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `<plan-path>` | String | (required) | Path to the refined plan (`step-02-*.plan.refined.md`) or the draft plan (`step-01-*.plan.md`). |
| `thresholds=<path>` | String | `config.json` | Threshold limits for sequential auto-detection. |

---

## Size Detection (Sequential Mode)

Before generating the task graph, evaluate the size of the plan using the following thresholds (from `config.json.dagThresholds` or standard defaults):

| Metric | Threshold | Method of Evaluation |
|--------|-----------|----------------------|
| Steps | `≤ 3` | Count steps under section 3 (Step-by-Step Plan). |
| Files | `≤ 6` | Count total files to create/modify in the file matrix. |
| Layers | `≤ 2` | Count unique layers (e.g. Core, Infrastructure, API, Web). |

- **Sequential Mode:** If **all** metrics are within the thresholds, set `execMode: "sequential"` and bypass DAG generation.
- **Parallel Mode:** If **any** metric exceeds the threshold, or if the plan's step breakdown is ambiguous, default to `execMode: "parallel"`.

---

## Output Formats

### 1. Sequential Mode Output

When sequential execution is selected, write:

#### `step-03-{slug}.plan.exec.md`
```markdown
# {slug} — Execution Plan (Sequential)
**Mode:** sequential — small plan, direct execution without DAG.
**Reason:** {n} steps, {m} files, {k} layers — below thresholds.

Run via `implement-tasks` build mode using the plan file directly.
```

#### `step-03-{slug}.exec.dag.json`
```json
{
  "execMode": "sequential",
  "reason": "{n} steps, {m} files, {k} layers — sequential execution is more efficient.",
  "planPath": "step-02-{slug}.plan.refined.md",
  "tasks": [],
  "levels": []
}
```

---

### 2. Parallel Mode (DAG) Output

When parallel execution is selected, decompose steps into atomic tasks ($T_1, T_2, \dots$). Ensure that:
- Two concurrent tasks in the same topological level **never** touch the same file.
- There are **maximum 3 concurrent tasks** per level.

Write the following outputs:

#### `step-03-{slug}.plan.exec.md` (Human-readable)
A markdown document outlining the task schedule, displaying the levels, task dependencies, target files, acceptance criteria, and coder prompts.

#### `step-03-{slug}.exec.dag.json` (Machine-readable)
```json
{
  "execMode": "parallel",
  "targetModel": "coder",
  "tasks": [
    {
      "id": "T1",
      "parallelGroup": null,
      "dependsOn": [],
      "files": ["src/Core/Withdrawals/WithdrawalDto.cs"],
      "acceptance": "DTO exposes mapped properties with DataAnnotations validations.",
      "coderPrompt": "Create WithdrawalDto in the Core layer following the existing pattern (record, persistence-agnostic).",
      "title": "Create WithdrawalDto"
    }
  ],
  "levels": [["T1"], ["T2", "T3"]]
}
```

---

## Rules of Engagement

- **Do not write product code:** Only structure the plan into tasks.
- **Strict Isolation:** Ensure tasks in the same parallel level do not share files to prevent merge conflicts during worktree parallel execution.
- **Reference stack:** Consult `config.json` configurations to verify layer boundaries and project paths.
