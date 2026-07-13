---
name: 11-ship-pr
description: End-to-end delivery — verify branch state, commit, push, create PR workingBranch → baseBranch, run goal-fix-pr loops, and merge.
upstream: jpolvora/workflow-skills — this skill is a spec-to-pr pipeline dependency. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 1.2
disable-model-invocation: true
---

# ship-pr

Responsible for shipping the completed workflow from the configured working branch (`config.project.workingBranch`, default `develop`) to the production base branch (`config.project.baseBranch`, typically `main` or `master`). It automates validation, branch push, PR creation, thread convergence monitoring, and final merging.

---

## Invocation

### Standalone Mode

```
/ship-pr [commit-title] [base=<branch>] [head=<branch>] [dry-run] [no-merge] [max <n>]
```

### Workflow Mode (Step 13 of spec-to-pr)

Dispatched by `spec-to-pr` when the `--full` flag is active. Steps 0–12 have already completed. The code-review and auto-fix phases are **skipped** (already done in Step 9 and Step 10).

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `commit-title` | String | (optional) | Custom commit message for any uncommitted changes. |
| `base=<branch>` | String | `config.project.baseBranch` | Target merge branch. Auto-detect `main`/`master` if unset. |
| `head=<branch>` | String | `config.project.workingBranch` (default `develop`) | Branch to push and use as PR head. |
| `dry-run` | Flag | `false` | Simulate without commits, push, or real PR API requests. |
| `no-merge` | Flag | `false` | Create PR and run checks, but stop before merge. |
| `max <n>` | Integer | `10` | Iteration limit for the `goal-fix-pr` convergence loop. |

Before executing, restate: **commit title**, **working (head) branch**, **base branch**, **mode**, **max iterations**. Resolve branches from `.agents/skills/spec-to-pr/config.json` when flags omit them.

---

## spec-to-pr Integration (Step 13)

1. Steps 0–12 are already completed.
2. Orchestrator approval gate:
   - **Create PR and start monitoring:** push, create PR, converge, merge.
   - **Push only (no PR):** push `{workingBranch}` only.
   - **Skip (done):** no push/PR.
3. Skip code-review / auto-fix inside ship-pr (already done in Steps 9–10).

---

## Pipeline Execution

```
0. Preflight ? 1. Code-Review Loop ? 2. Verification ? 3. Commit & Push ? 4. PR Creation ? 5. goal-fix-pr ? 6. Merge
```

### Phase 0 — Preflight Checks
- Resolve `workingBranch` = `config.project.workingBranch` (default `develop`), `baseBranch` = `config.project.baseBranch`, `gitRemote` = `config.project.gitRemote` (default `origin`).
- Ensure active branch is `{workingBranch}` (checkout only with explicit user consent).
- `git pull {gitRemote} {workingBranch}`.
- Auto-detect `main`/`master` when `baseBranch` is unset (`scripts/detect-base-branch.sh`).
- Stop if unexpected dirty files outside the delivery scope.

### Phase 1 — Code-Review Loop (auto-fix)
- Load [code-review](../06-code-review/SKILL.md) vs base branch.
- Fix Critical/Warning up to 3 iterations.
- Skip when already reviewed under `spec-to-pr`.

### Phase 2 — Project Verification
- Run `config.json.verification` commands; auto-correct up to 3 times, then stop.

### Phase 3 — Commit & Push
- Commit remaining delivery-related changes with a professional message.
- `git push -u {gitRemote} {workingBranch}`.

### Phase 4 — PR Creation
- If no open PR from `{workingBranch}` ? `{baseBranch}`, create: `gh pr create --head {workingBranch} --base {baseBranch}`.
- Capture PR number and URL.

### Phase 5 — goal-fix-pr Convergence Loop
- Wait 5 minutes (300s) post-push for CI/reviewer feedback.
- Dispatch [goal-fix-pr](../09-goal-fix-pr/SKILL.md) until `activeThreads == 0` or `max` iterations.

### Phase 6 — Merge
- `gh pr checks --watch`.
- `gh pr merge --merge`.

> [!IMPORTANT]
> **Branch Deletion Rule:** Never delete `{workingBranch}` after merging. Keep it for future delivery loops.

---

## Final Output

Print the PR URL alone on its own line at the end:

```markdown
**PR:** https://github.com/<owner>/<repo>/pull/<PR-NUMBER>
```

In `dry-run` or early stop: `PR not created` plus explanation (no placeholder URL).

---

## Dependencies

- **Reviewer:** [code-review](../06-code-review/SKILL.md)
- **Convergence:** [goal-fix-pr](../09-goal-fix-pr/SKILL.md)
- **Fixer:** [fix-pr](../08-fix-pr/SKILL.md)
- **Base Detection:** `scripts/detect-base-branch.sh`
- **Artifacts:** [ARTIFACTS.md](../spec-to-pr/ARTIFACTS.md)
