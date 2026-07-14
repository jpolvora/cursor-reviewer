---
name: 09-goal-fix-pr
description: Convergence loop — runs fix-pr rounds until all PR threads are resolved or the max iteration cap is reached.
upstream: jpolvora/workflow-skills — this skill is a spec-to-pr pipeline dependency. Improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 1.1
disable-model-invocation: true
---

# 09-goal-fix-pr

Responsible for driving PR review thread convergence to zero. It wraps the [08-fix-pr](../08-fix-pr/SKILL.md) skill in a goal loop, auto-approving cooperative gates and re-checking threads after every push until `activeThreads == 0`. Thread-count probes and fix rounds are **SCM-aware**: resolve `providers.scm`, then delegate platform I/O — do not hardcode GitHub-only (`gh pr view`) or ADO-only recipes in this skill’s happy path.

---

## Invocation

### Standalone Mode

```
/goal-fix-pr <PR-NUMBER> [dry-run] [max <n>]
```

This skill wraps the [`goal-loop`](../shared/goal-loop/SKILL.md) generic primitive as its orchestrator, executing [`08-fix-pr`](../08-fix-pr/SKILL.md) tasks for each action round.

### Workflow Mode (Step 12 of spec-to-pr)

Dispatched automatically by `spec-to-pr` when `ship-pr` triggers thread convergence monitoring. Receives `PR-NUMBER` and `max` from the orchestrator's parameters.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `<PR-NUMBER>` | Integer | (required) | Target Pull Request number. |
| `dry-run` | Flag | `false` | Simulate fixes and resolutions without committing, pushing, or calling platform resolve APIs. |
| `max <n>` | Integer | `5` | Maximum iteration ceiling before stopping (default 5 loops). |
| `wait <n>` | Integer | `300` | Post-round/pre-check wait interval in seconds (default 5 minutes / 300s). |

Before executing, restate the parsed parameters: **PR number**, **success criteria**, **mode**, **max iterations (default 5)**, **check interval (default 300s)**, **dry-run active**, **`providers.scm`**.

---

## SCM resolution (mandatory)

1. Read `.agents/skills/spec-to-pr/config.json` (or `.agents/skills/spec-to-pr-lite/config.json` if running `spec-to-pr-lite`).
2. Resolve SCM host = `providers.scm` (fallback: enabled tracker / `project.repoUrl` inference — same rules as provider skills).
3. Load the matching provider skill and use its intents for thread count only; keep scoring/fix/verify in [08-fix-pr](../08-fix-pr/SKILL.md).

| `providers.scm` | Provider skill | Thread-count intent |
|-----------------|----------------|---------------------|
| `github` | [github-provider](../github-provider/SKILL.md) | `list-threads` |
| `azure-devops` | [azure-devops-provider](../azure-devops-provider/SKILL.md) | `list-threads` |

---

## Success Criterion

**Convergence:** `len(activeThreads) == 0` after a `list-threads` run on the resolved SCM provider.

- Call the provider’s `list-threads` intent with `<PR-NUMBER>` (see provider SKILL for script/CLI details).
- `activeThreads` = unresolved / active threads from that response (provider normalizes status).
- Do **not** embed `gh pr view … jq` or raw ADO collect commands here — those live only inside the provider skills.

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

This skill inherits the FSM execution loop directly from [`goal-loop`](../shared/goal-loop/SKILL.md):

```
Goal: fix-pr PR-<N> until convergence (scm = providers.scm)
Success: activeThreads == 0 via SCM list-threads, verified after heartbeat check
Iteration: <n>/<max>
- [ ] scm list-threads → count activeThreads
- [ ] if activeThreads == 0 on first loop:
      - arm 5-minute heartbeat timer immediately
      - wait 300s + re-collect
      - if activeThreads remains 0 → DONE
      - if activeThreads > 0 → proceed to act round
- [ ] 08-fix-pr round (if activeThreads > 0)
- [ ] verify build/tests + code-review auto-check (via Phase 3 Verification)
- [ ] commit + resolve + push (skip if dry-run)
- [ ] wait 5min (arm sentinel) + re-collect
```

### Initial Heartbeat Check (Zero Threads Case)
If `activeThreads` counts as `0` on initialization (Iteration 1), **do not exit immediately**. Start the 5-minute (`300s`) heartbeat timer immediately via `goal-loop` sentinel. Wait for CI/Actions/Reviewer updates, re-query, and:
- If `activeThreads` remains `0` → stop and mark completed (DONE).
- If `activeThreads > 0` → proceed to Phase 2 (Act).

### Phase 2 — Act (08-fix-pr Round)
Dispatch [`08-fix-pr`](../08-fix-pr/SKILL.md) for `<PR-NUMBER>` with overrides active.
- **Commit**: `fix(#<PR-NUMBER>): fix issues from review threads [<threadId>, ...]`
- **Resolve**: mark threads resolved via [`08-fix-pr`](../08-fix-pr/SKILL.md) SCM integration.
- **Push**: `git push origin HEAD` (skip if `dry-run`).

### Phase 3 — Verification (Mandatory)
Run `config.json.verification` commands + `06-code-review` diff check. Three consecutive failures on verification stops the loop and escalates.

---

## Stop Conditions

Exits under the standard [`goal-loop`](../shared/goal-loop/SKILL.md) stop conditions:
- `activeThreads == 0` (after verification check).
- User requests abort.
- `max` ceiling reached (default 5 loops).
- Escalation (unresolved ambiguity or 3 consecutive verification failures).
- SCM communication error.

---

## Final Report (Mandatory)

At the end of every run (whether converged or stopped), output:
1. Number of iterations executed and the stop condition.
2. Threads handled per round (fixed / resolved / escalated).
3. Links to generated round reports (`.cursor/codereviews/PR-<N>-round-*.md`).
4. Commit hashes and push confirmation.
5. Final `activeThreads` count with evidence from the last SCM `list-threads` collect (`providers.scm` + provider skill).
6. PR URL.
