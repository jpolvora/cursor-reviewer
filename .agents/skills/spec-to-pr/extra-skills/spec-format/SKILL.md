---
name: spec-format
description: >-
  Creates, reviews, or formats *.spec.md artifacts (local US/feature specification). Project-agnostic.
  Load when the user invokes /spec-format, @spec-format, "create spec", "review spec",
  "format spec" or requests validation of local specification format.
upstream: jpolvora/workflow-skills — this skill is a spec-to-pr pipeline dependency. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
disable-model-invocation: true
version: 1.0
---

# spec-format — Canonical `*.spec.md` format

Skill to **create**, **review**, or **format** local specifications (`*.spec.md`) — a single, portable artifact for a feature/US. Replaces direct GitHub reading in downstream skills; all read `*.spec.md` from the working directory.

> **Canonical source of the `*.spec.md` format.** Other skills and `spec-to-pr` **reference** this skill — they do not duplicate frontmatter, sections, or validation rules. See also [`AGENTS.md`](../../../../../AGENTS.md) § Skill loading.

> **Language:** responses to user in **en-us**.

## Invocation triggers

| Trigger | Example |
|---------|---------|
| Command | `/spec-format`, `@spec-format` |
| Create | "create spec", "generate spec", "new specification" |
| Review | "review spec", "validate spec", "audit spec" |
| Format | "format spec", "fix spec format" |

## Modes

| Mode | When | Output |
|------|--------|-------|
| **create** | User describes a feature or provides a GitHub issue without a local spec | New `*.spec.md` file in canonical format |
| **review** | Existing spec with possible gaps or format drift | Gap report + proposed fixes (edit only with approval) |
| **format** | Spec with valid content but frontmatter/sections outside the standard | Spec reformatted in-place or proposed diff |

If the mode is not explicit, infer from context or ask.

## File name

| Source | Pattern | Example |
|--------|--------|---------|
| GitHub issue `{id}` | `step-00-us-{id}.spec.md` in `{plans-dir}/us-{id}/` | `step-00-us-1474.spec.md` |
| Azure DevOps work item `{id}` | `step-00-us-{id}.spec.md` in `{plans-dir}/us-{id}/` | `step-00-us-2416.spec.md` |
| Hand-written / local slug | `step-00-{slug}.spec.md` in `{plans-dir}/{slug}/` | `step-00-my-feature.spec.md` |

The working directory **slug** (`{us-dir}`) is:
- `us-{id}` when the input is a GitHub issue or Azure DevOps work item id;
- the basename of the file (without `.spec.md`, strip optional `step-00-` prefix) when the input is a local/hand-written spec — e.g.: `my-feature.spec.md` → folder `.cursor/plans/my-feature/`.

## YAML Frontmatter (required)

```yaml
---
id: 1474              # integer — tracker id; null if purely local/hand-written
slug: us-1474         # working folder identifier (us-{id} or spec name)
title: "Feature title"
source: github        # github | azure-devops | local
issueState: open      # optional — issue/work-item state when from a tracker
issueUrl: "https://github.com/{org}/{repo}/issues/1474"  # optional
workItemType: "User Story"  # optional — Azure DevOps System.WorkItemType
specDate: 2026-07-02  # generation date or last relevant update
---
```

## Body (required sections)

```markdown
# Specification — {title}

## Description

(description text — GitHub issue body in Markdown when applicable)

## Acceptance Criteria

- AC1: …
- AC2: …

## Child Tasks

(optional — filled when `source: github` and the issue had sub-tasks/checklist)

### Task #{id} — {title}

- **Status:** …
- **Description:** …

## Notes

(links, dependencies, extra context — optional)
```

## Validation rules

1. **Acceptance Criteria** must be enumerable and testable — one line per AC.
2. When `source: local`, the author is responsible for complete ACs; there is no tracker fetch.
3. The raw `*.issue.json` snapshot (when it exists) is **audit-only** — downstream skills do **not** read `issue.json` directly; they always read `spec.md`.
4. Hand-written specs can live under `specs/`, `.cursor/plans/specs/`, or any path — `spec-to-pr` copies/normalizes to `{us-dir}/step-00-{slug}.spec.md` at entry.

## Flow — review mode

1. Read the provided `*.spec.md` (or locate in `{us-dir}/`).
2. Validate frontmatter, required sections, and AC quality (enumerable, testable, unambiguous).
3. Cross-reference with [`docs/superpowers/specs/2026-05-27-matrix-saas-design.md`](../../../../../docs/superpowers/specs/2026-05-27-matrix-saas-design.md) when there is parity with legacy.
4. Emit report:

| Check | Status | Proposed fix |
|-------------|--------|-------------------|
| Frontmatter complete | OK / FAIL | … |
| Description section | OK / FAIL | … |
| ACs testable | OK / FAIL | … |

5. **Do not edit** without explicit user approval (`apply fixes`, `format`).

## Flow — create mode

1. Collect title, description, and ACs (free text, GitHub via `gh`, Azure DevOps via `ado-workitem-to-spec.py`, or user draft).
2. If input is a GitHub issue number: `gh issue view {n}` + `.agents/skills/spec-to-pr/scripts/github-issue-to-spec.py`.
3. If input is an Azure DevOps work item: `.agents/skills/spec-to-pr/scripts/ado-workitem-to-spec.py` (see `spec-to-pr` → Specification Protocol).
4. If input is an existing hand-written `*.spec.md`: validate/format in place or copy to the canonical `step-00-` path — do not invent tracker fields.
5. Generate/confirm file at the canonical path with complete frontmatter and sections.
6. Confirm final path to user.

## Downstream consumers

`spec-to-pr`, `01-write-plan`, `02-interview`, `05-verify-plan`, `07-integration-validation` read **`{us-dir}/step-00-{slug}.spec.md`** — never live tracker APIs and never `*.issue.json`. See [`ARTIFACTS.md`](../../ARTIFACTS.md).

## References

- Harness routing: [`AGENTS.md`](../../../../../AGENTS.md)
- Architecture: [`docs/superpowers/specs/2026-05-27-matrix-saas-design.md`](../../../../../docs/superpowers/specs/2026-05-27-matrix-saas-design.md)
- Workflow protocol: [`../../spec-to-pr/SKILL.md`](../../spec-to-pr/SKILL.md) → Specification Protocol
