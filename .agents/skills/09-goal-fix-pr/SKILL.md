---
name: 09-goal-fix-pr
description: Convergence loop — runs fix-pr rounds until all PR threads are resolved or the max iteration cap is reached.
upstream: jpolvora/workflow-skills — this skill is a spec-to-pr pipeline dependency. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 1.1
disable-model-invocation: true
---

# 09-goal-fix-pr

Responsible for driving PR review thread convergence to zero. It wraps the [08-fix-pr](../08-fix-pr/SKILL.md) skill in a goal loop, auto-approving cooperative gates and re-checking threads after every push until `activeThreads == 0`.

---

## Invocation

### Standalone Mode

```
/goal-fix-pr <PR-NUMBER> [dry-run] [max <n>]
```

### Workflow Mode (Step 13 of spec-to-pr, inside ship-pr)

Dispatched automatically by `spec-to-pr` when `ship-pr` triggers thread convergence monitoring. Receives `PR-NUMBER` and `max` from the orchestrator's parameters.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `<PR-NUMBER>` | Integer | (required) | Target Pull Request number. |
| `dry-run` | Flag | `false` | Simulate fixes and resolutions without committing, pushing, or calling platform resolve APIs. |
| `max <n>` | Integer | `20` | Maximum iteration ceiling before stopping and escalating. |

Before executing, restate the parsed parameters: **PR number**, **success criteria**, **mode**, **max iterations**, **dry-run active**.

---

## Success Criterion

**Convergence:** `len(activeThreads) == 0` after a thread collection run.

- **GitHub:** `gh pr view <PR-NUMBER> --json comments --jq '[.comments[] | select(.isResolved == false)] | length'`
- **Azure DevOps:** `fix_pr_azure_context.py collect` → `activeThreads` count

---

## Automation Overrides (vs. fix-pr defaults)

When running inside `goal-fix-pr`, the following `fix-pr` interactive gates are **bypassed**:

| fix-pr Gate | goal-fix-pr Behavior |
|-------------|----------------------|
| Confirmation gate (plan-gate.md) | **Auto-yes** — save gate file and proceed. |
| Commit + resolve + push gate | **Auto** — execute unless `dry-run` is active. |
| **Escalate** threads | **Stop iteration** — block until user resolves ambiguity. |
| CI Auto-Fix `in_progress` | **Inform** user — do not auto-block. |

---

## Core Loop

Track progress across iterations:

```
Goal: fix-pr PR-<N> until convergence
Success: activeThreads == 0
Iteration: <n>/<max>
- [ ] branch sync (PR head)
- [ ] collect + count threads
- [ ] fix-pr round (if > 0 threads)
- [ ] verify build/tests + code-review auto-check
- [ ] commit + resolve + push (if code changed)
- [ ] wait 5min + re-collect
```

### Phase 1 — Baseline (Iteration 1)
- Collect active threads from the PR platform.
- If `activeThreads == 0` on first collect → final report and stop (already converged).

### Phase 2 — Act (fix-pr Round)
- Execute `fix-pr` steps 0–7 with automation overrides for active threads.
- Commit: `fix(#<PR-NUMBER>): fix issues from review threads [<threadId>, ...]`.
- Resolve threads on the platform.
- Push: `git push origin HEAD` (skip if `dry-run`).

### Phase 3 — Verify (Mandatory after each round)

| Check | Required Evidence |
|-------|------------------|
| Build/Tests | Output from `config.json.verification` commands |
| Auto-review | **"No feedback"** from `06-code-review` on current diff |
| Push | Commit hash + push confirmation (or dry-run log) |
| Resolved threads | `resolve_thread` exited with code 0 |

3 consecutive failures on the same check → stop and escalate.

### Phase 4 — Post-push Heartbeat (5 minutes)
- After each push round, wait 300 seconds for new CI/reviewer feedback to register.
- Sentinel: `AGENT_GOAL_WAKE_fixpr_<PR-NUMBER>`.
- Do not stack multiple sleepers — exactly one active at a time.

### Phase 5 — Re-collect
- On wake: re-count `activeThreads`.
- `== 0` → **done**.
- `> 0` and `n < max` → start iteration `n+1`.
- `n >= max` → stop, report remaining threads, request larger `max`.

---

## Stop Conditions

| Condition | Action |
|-----------|--------|
| `activeThreads == 0` | Final report + kill heartbeat sleeper |
| User requests stop | Kill sleeper, summarize progress so far |
| Escalate thread hit | Stop, list blocked thread IDs |
| `n >= max` | Stop, list active threads |
| Platform collect fails | Stop — do not improvise API calls |

---

## Final Report (Mandatory)

At the end of every run (whether converged or stopped), output:
1. Number of iterations executed and the stop condition.
2. Threads handled per round (fixed / resolved / escalated).
3. Links to generated round reports (`.cursor/codereviews/PR-<N>-round-*.md`).
4. Commit hashes and push confirmation.
5. Final `activeThreads` count with evidence from the last collect.
6. PR URL.
