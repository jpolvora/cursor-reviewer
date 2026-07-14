---
name: 00-write-spec
description: Receives a high-level feature description and drafts a canonical step-00-{slug}.spec.md specification.
upstream: jpolvora/workflow-skills — this skill is a spec-to-pr pipeline dependency. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 3.2
disable-model-invocation: true
---

# 00-write-spec

Responsible for taking raw, free-text feature descriptions and drafting a canonical, structured specification document. The resulting file serves as the input specification for downstream planning steps.

Canonical path is always `{us-dir}/step-00-{slug}.spec.md` (`us-dir` = `{plans.dir}/{slug}/`). Optional human-browsable mirrors under `plans.specsDir` are owned by [local-spec-provider](../local-spec-provider/SKILL.md) — do not duplicate mirror logic here.

---

## Invocation

### Standalone Mode

```
/write-spec "<description>" [slug=<slug>] [output-dir=<path>] [--mirror]
```

### Workflow Mode (Step 0 of spec-to-pr)

Dispatched by `spec-to-pr` at Step 0 with the issue body or feature text from context. Receives `description` and optional `slug` from the orchestrator's input. Optional post-draft mirror when the caller requests it or when mirroring is policy for local brainstorms.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `<description>` | String | (required) | Raw text description of the feature or business requirement. |
| `slug=<slug>` | String | (optional) | Unique URL-friendly identifier for the feature. Auto-generated from title/description if omitted. |
| `output-dir=<path>` | String | `.cursor/plans/{slug}/` | Destination folder for the drafted canonical spec (`{us-dir}`). |
| `--mirror` | Flag | `false` | After write, ask [local-spec-provider](../local-spec-provider/SKILL.md) to also write `{specsDir}/{slug}.spec.md`. |

---

## Output Template

Adhere to the canonical specification format defined by [spec-format](../shared/spec-format/SKILL.md). The generated file must be named `step-00-{slug}.spec.md` and start with the following frontmatter:

```markdown
---
id: null
slug: {slug}
title: "Feature Title"
source: local
specDate: YYYY-MM-DD
---

# Specification — {title}

## Description

(Detailed description of business needs, feature flows, and target audience)

## Acceptance Criteria

- AC1: (Specific, testable behavior metric)
- AC2: (Specific, testable behavior metric)

## Notes

(Technical context, architecture notes, constraints, or links)
```

---

## Pipeline Steps

1. **Parse & Infer:** Analyze the input text description. Infer the feature's name, title, and create a url-safe `slug`.
2. **Draft:** Construct the specification following the structure above. Ensure acceptance criteria (ACs) are clear, testable, and have no logical gaps.
3. **Write:** Save the resulting file to `{output-dir}/step-00-{slug}.spec.md` (canonical `{us-dir}` copy). Ensure `source: local`.
4. **Optional mirror:** If `--mirror` (or orchestrator requests a human-browsable copy), delegate to [local-spec-provider](../local-spec-provider/SKILL.md) — do **not** copy files yourself:

   ```bash
   python .agents/skills/local-spec-provider/scripts/register_local_spec.py \
     --input "{us-dir}/step-00-{slug}.spec.md" \
     --mirror
   ```

   That script normalizes `source: local` (in-place when input is already the canonical `step-00-` file) and writes `{plans.specsDir}/{slug}.spec.md` (default `specs/`). Use `--force` only when overwriting an existing mirror that differs. Canonical path remains the `step-00-` file under `{us-dir}`.
5. **Handoff:** Return the **canonical** path (`{us-dir}/step-00-{slug}.spec.md`) so that [01-write-plan](../01-write-plan/SKILL.md) can pick it up. Mention the mirror path only if one was written.

---

## Dual-mode notes

- **Standalone:** write canonical under `output-dir`; with `--mirror`, run the local-spec-provider register command above and print both paths.
- **Workflow:** write canonical; optional mirror when requested; orchestrator records `specPath` at the `step-00-` file and `specSource: local`.
- **Language:** en-us only.
