---
name: 08-fix-pr
description: Cooperatively resolve active PR code review threads on GitHub or Azure DevOps with structured validation and reports.
upstream: jpolvora/workflow-skills — this skill is a spec-to-pr pipeline dependency. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 1.1
disable-model-invocation: true
---

# 08-fix-pr

Responsible for fetching, scoring, and systematically resolving active review threads on GitHub or Azure DevOps Pull Requests. It orchestrates local code corrections, test validations, thread resolutions, and pushes changes back to the remote branch.

---

## Invocation

### Standalone Mode

```
/fix-pr <PR-ID> [dry-run]
```

### Workflow Mode (called by 09-goal-fix-pr)

Orchestrated by [09-goal-fix-pr](../09-goal-fix-pr/SKILL.md). All interactive confirmation gates are auto-approved by the goal loop. Receives `PR-ID` and `dry-run` flag from the goal.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `<PR-ID>` | Integer | (required) | Target Pull Request number. |
| `dry-run` | Flag | `false` | Run checks and simulate fixes/resolutions without pushing commits or resolving remote API threads. |

---

## Prerequisites

- **Branch checkout:** The local branch must match the PR source branch.
- **Git client:** Authenticated CLI (`gh` for GitHub, or REST credentials for Azure DevOps).
- **Security token:** `AGENTIC_CODE_REVIEWERS_GITHUB_TOKEN` (GitHub) or `AZURE_DEVOPS_PAT` (Azure DevOps).

---

## State Machine (FSM) Flow

```
[Sync & Check CI] ──> [Fetch Threads] ──> [Score Gaps] ──> [Confirmation Gate] ──> [Surgical Fix] ──> [Verify & Push]
```

### Phase 0 — Sync & CI Check
- Pull remote changes using `git pull origin <sourceRefName>`. Prevent overlapping fixes on dirty worktrees.
- Check if automated review runs are in progress. Recommend waiting if CI is active.

### Phase 1 — Fetch Active Threads
- Fetch threads using GraphQL (`fetch_threads.cjs`) or Python REST API collectors.
- Parse thread details: `threadId`, `filePath`, `lineNumber`, and `comments`.

### Phase 2 — Scoring & Classification
Score each thread on a `0–10` scale to categorize its urgency:

| Score | Urgency | Class | Action |
|-------|---------|-------|--------|
| **0–5** | Low | Non-blocking / Nit | Resolve with comment justifying why no code change is required. |
| **6–10** | High | Blocking / Bug | Apply surgical fixes in code. |

### Phase 3 — Confirmation Gate
- Save the proposed fix checklist to `.agents/skills/08-fix-pr/runs/pr-<PR-ID>/plan-gate.md` (uncommitted).
- Request user confirmation: `Proceed with fixes for threads [ID1, ID2]?`.

### Phase 4 — Execution & Surgical Fix
- For code fixes: analyze call sites, test scopes, and verify adjacent logic.
- Apply surgical edits (no scope creep) following Karpathy guidelines. Fix the defect class globally (check siblings in other files).

### Phase 5 — Verification & Push
- Run verification tests defined in `config.json.verification`.
- Generate review report: `.cursor/codereviews/PR-<PR-ID>-round-<N>.md`.
- Resolve threads on the platform, stage changed files + report, and commit.
- Push changes using `git push origin HEAD` (skip push if `dry-run`).
