---
name: 08-fix-pr
description: Cooperatively resolve active PR code review threads on GitHub or Azure DevOps with structured validation and reports.
upstream: jpolvora/workflow-skills — this skill is a spec-to-pr pipeline dependency. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 1.1
disable-model-invocation: true
---

# 08-fix-pr

Responsible for fetching, scoring, and systematically resolving active review threads on GitHub or Azure DevOps Pull Requests. It orchestrates local code corrections, test validations, thread resolutions, and pushes changes back to the remote branch.

Platform I/O (`list-threads`, `resolve-thread`) is **delegated** to the skill selected by `config.providers.scm` — never hardcode a single-host happy path here. Scoring and the fix FSM stay generic in this skill.

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
- **Config:** `.agents/skills/spec-to-pr/config.json` (or `.agents/skills/spec-to-pr-lite/config.json` if running `spec-to-pr-lite`) with resolvable `providers.scm` (`github` | `azure-devops`; never `local`).
- **SCM provider skill:** Load [github-provider](../github-provider/SKILL.md) or [azure-devops-provider](../azure-devops-provider/SKILL.md) per resolution below; run that skill’s `validate-auth` before mutating remote threads.
- **Git client / tokens:** As required by the selected scm provider (`gh` + GraphQL token for GitHub; PAT / `az` for Azure DevOps).

---

## SCM provider resolution (`providers.scm`)

1. Read `providers.active` / `providers.scm` from `spec-to-pr/config.json` (or `spec-to-pr-lite/config.json` if running `spec-to-pr-lite`).
2. If `providers` absent: enabled GitHub tracker → scm=`github`; else enabled Azure DevOps → scm=`azure-devops`; else STOP (require explicit `providers.scm`). Prefer GitHub if both enabled.
3. If `scm` absent: if active is `github`|`azure-devops` → scm=active; if active=`local` → parse `project.repoUrl` host (`github.com` → github; `dev.azure.com` / `visualstudio.com` → azure-devops); else STOP and require explicit `providers.scm`.
4. Reject `scm: "local"`.
5. Load the matching provider skill and call intents by name — do not embed host CLI recipes in Phases 1/5 beyond the intent names.

| `providers.scm` | Skill | Intents used here |
|-----------------|-------|-------------------|
| `github` | [github-provider](../github-provider/SKILL.md) | `list-threads`, `resolve-thread` |
| `azure-devops` | [azure-devops-provider](../azure-devops-provider/SKILL.md) | `list-threads`, `resolve-thread` |

Canonical scripts live under those providers. Thin forwarder shims remain at `.agents/skills/08-fix-pr/scripts/` for mid-migration callers — prefer provider paths / intents.

---

## State Machine (FSM) Flow

```
[Sync & Check CI] ──> [Fetch Threads] ──> [Score Gaps] ──> [Confirmation Gate] ──> [Surgical Fix] ──> [Verify & Push]
```

### Phase 0 — Sync & CI Check
- Pull remote changes using `git pull origin <sourceRefName>`. Prevent overlapping fixes on dirty worktrees.
- Check if automated review runs are in progress. Recommend waiting if CI is active.

### Phase 1 — Fetch Active Threads
- Resolve `providers.scm` (section above) and load the scm provider skill.
- Call provider intent **`list-threads`** with `<PR-ID>` (provider runs its canonical collector — GitHub: `fetch_threads.cjs`; Azure DevOps: `fix_pr_azure_context.py collect`).
- Parse thread details: `threadId`, `filePath`, `lineNumber`, and `comments`.
- **Active count:** use the provider payload’s `activeThreads` (ADO collect also prints `collect-summary:` on stderr). Do **not** re-filter raw ADO statuses in ad-hoc Python.
- **Windows UTF-8:** if you must read `context.json` (or any collect `--output` file), always open with UTF-8 — e.g. `Path(...).read_text(encoding="utf-8")` or `open(..., encoding="utf-8")`. Bare `open(path)` uses the Windows locale (`cp1252`) and raises `UnicodeDecodeError` on review text.

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
- Resolve each handled thread via scm provider intent **`resolve-thread`** (skip remote mutation when `dry-run`). Include the `<!-- resolution-reply -->` marker in the resolution comment body.
- Stage changed files + report, and commit.
- Push changes using `git push origin HEAD` (skip push if `dry-run`).
