---
name: 11-ship-pr
description: End-to-end delivery — verify branch state, commit, push, create PR workingBranch → baseBranch via providers.scm, run goal-fix-pr loops, and merge.
upstream: jpolvora/workflow-skills — this skill is a spec-to-pr pipeline dependency. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 1.3
disable-model-invocation: true
---

# ship-pr

Responsible for shipping the completed workflow from the configured working branch (`config.project.workingBranch`, default `develop`) to the production base branch (`config.project.baseBranch`, typically `main` or `master`). It automates validation, branch push, PR creation via the SCM provider selected by `config.providers.scm`, thread convergence monitoring, and final merging.

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

Before executing, restate: **commit title**, **working (head) branch**, **base branch**, **SCM provider (`providers.scm`)**, **mode**, **max iterations**. Resolve branches and provider from `.agents/skills/spec-to-pr/config.json` (or `.agents/skills/spec-to-pr-lite/config.json` if running `spec-to-pr-lite`) when flags omit them.

---

## spec-to-pr Integration (Step 13)

1. Steps 0–12 are already completed (or Step 4 for `spec-to-pr-lite`).
2. Orchestrator approval gate:
   - **Create PR and start monitoring:** push, create PR, converge, merge.
   - **Push only (no PR):** push `{workingBranch}` only.
   - **Skip (done):** no push/PR.
3. Skip code-review / auto-fix inside ship-pr (already done in Steps 9–10 or Step 3 for `spec-to-pr-lite`).

---

## Pipeline Execution

```
0. Preflight → 1. Code-Review Loop → 2. Verification → 3. Commit & Push → 4. PR Creation → 5. goal-fix-pr → 6. Merge
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
- Skip when already reviewed under `spec-to-pr` or `spec-to-pr-lite`.

### Phase 2 — Project Verification
- Run `config.json.verification` commands; auto-correct up to 3 times, then stop.

### Phase 3 — Commit & Push
- Commit remaining delivery-related changes with a professional message.
- `git push -u {gitRemote} {workingBranch}`.

### Phase 4 — PR Creation (SCM provider)

1. Resolve `providers.scm` (same algorithm as [spec-to-pr](../spec-to-pr/SKILL.md) Provider resolution / [local-spec-provider](../local-spec-provider/SKILL.md)):
   - Read `providers.active` / `providers.scm` from `.agents/skills/spec-to-pr/config.json` (or `.agents/skills/spec-to-pr-lite/config.json` if running `spec-to-pr-lite`).
   - If `providers` absent: enabled GitHub → `github`; else enabled ADO → `azure-devops`; else STOP and require explicit `providers.scm` (ship needs a remote SCM host).
   - If `scm` absent: if active is `github`|`azure-devops` → scm=active; if active=`local` → parse `project.repoUrl` host (`github.com` → github; `dev.azure.com` / `visualstudio.com` → azure-devops); else STOP and require explicit `providers.scm`.
   - Reject `scm: "local"`.
2. Load the SCM provider skill:
   - `github` → [github-provider](../github-provider/SKILL.md)
   - `azure-devops` → [azure-devops-provider](../azure-devops-provider/SKILL.md)
3. Run provider `validate-auth` when needed; **STOP** on failure (no silent fallback to another provider).
4. Dispatch provider intent `create-pr` with `--head {workingBranch}` `--base {baseBranch}` (title/body from commit context or flags). Provider reuses an existing open PR for the same head→base when present.
5. Capture PR id and URL from the provider. Do **not** embed raw `gh pr create` / `az repos pr create` recipes here — follow the loaded provider skill.

### Phase 5 — goal-fix-pr Convergence Loop
- Wait 5 minutes (300s) post-push for CI/reviewer feedback.
- Dispatch [goal-fix-pr](../09-goal-fix-pr/SKILL.md) until `activeThreads == 0` or `max` iterations (thread list/resolve via `providers.scm` inside `08`/`09`).

### Phase 6 — Merge (SCM provider)

1. Using the same loaded SCM provider from Phase 4, dispatch intent `merge-pr` with the captured PR id.
2. The provider waits for checks/policies (GitHub: checks watch; Azure DevOps: policy/status wait) then completes the merge. Do **not** hardcode `gh pr checks` / `gh pr merge` / `az repos pr update` in this skill’s happy path.
3. Skip this phase when `no-merge` is set (PR created and checks/threads handled; stop before merge).

> [!IMPORTANT]
> **Branch Deletion Rule:** Never delete `{workingBranch}` after merging. Keep it for future delivery loops. Do not pass provider flags that delete the configured working branch (e.g. `gh pr merge --delete-branch`).

---

## Final Output

Print the PR URL returned by the SCM provider (GitHub or Azure DevOps) alone on its own line at the end:

```markdown
**PR:** {provider-returned-url}
```

In `dry-run` or early stop: `PR not created` plus explanation (no placeholder URL).

---

## Dependencies

- **SCM providers:** [github-provider](../github-provider/SKILL.md) · [azure-devops-provider](../azure-devops-provider/SKILL.md) — selected by `providers.scm`
- **Reviewer:** [code-review](../06-code-review/SKILL.md)
- **Convergence:** [goal-fix-pr](../09-goal-fix-pr/SKILL.md)
- **Fixer:** [fix-pr](../08-fix-pr/SKILL.md)
- **Base Detection:** `scripts/detect-base-branch.sh`
- **Artifacts:** [ARTIFACTS.md](../spec-to-pr/ARTIFACTS.md)
