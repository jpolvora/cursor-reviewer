---
name: 00-write-spec
description: Receives a high-level feature description and drafts a canonical step-00-{slug}.spec.md specification.
upstream: jpolvora/workflow-skills — this skill is a spec-to-pr pipeline dependency. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 3.1
disable-model-invocation: true
---

# 00-write-spec

Responsible for taking raw, free-text feature descriptions and drafting a canonical, structured specification document. The resulting file serves as the input specification for downstream planning steps.

---

## Invocation

### Standalone Mode

```
/write-spec "<description>" [slug=<slug>] [output-dir=<path>]
```

### Workflow Mode (Step 0 of spec-to-pr)

Dispatched by `spec-to-pr` at Step 0 with the issue body or feature text from context. Receives `description` and optional `slug` from the orchestrator's input.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `<description>` | String | (required) | Raw text description of the feature or business requirement. |
| `slug=<slug>` | String | (optional) | Unique URL-friendly identifier for the feature. Auto-generated from title/description if omitted. |
| `output-dir=<path>` | String | `.cursor/plans/{slug}/` | Destination folder for the drafted spec. |

---

## Output Template

Adhere to the canonical specification format defined by [spec-format](../spec-to-pr/extra-skills/spec-format/SKILL.md). The generated file must be named `step-00-{slug}.spec.md` and start with the following frontmatter:

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
3. **Write:** Save the resulting file to the output directory as `step-00-{slug}.spec.md`.
4. **Handoff:** Return the path to the written file so that [01-write-plan](../01-write-plan/SKILL.md) can pick it up.
