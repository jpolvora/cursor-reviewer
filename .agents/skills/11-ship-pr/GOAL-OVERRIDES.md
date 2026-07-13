# ship-pr — goal-fix-pr timing overrides

Load with [SKILL.md](SKILL.md) step 5. Parent loop: [goal-fix-pr](../09-goal-fix-pr/SKILL.md).

## Why 5 minutes

Agentic Code Review and human reviewers often comment **after** the first push. ship-pr waits before the first fix-pr act and between rounds so the PR thread state stabilizes.

## Overrides

| goal-fix-pr default | ship-pr |
|---------------------|---------|
| Iteration 1 starts after first collect | **300s sleep**, then collect |
| `sleep 120` post-push heartbeat | **`sleep 300`** |
| Sentinel `AGENT_GOAL_WAKE_fixpr_<N>` | **`AGENT_SHIP_PR_WAKE_<N>`** |
| `max` default 20 | Parse token (default **10**) |

Everything else unchanged: branch sync, fix-pr steps 0–7, auto gates, commit message `fix(#<PR>): auto-fix issues from review threads [...]`, verify build/tests, Escalar stops the pipeline.

## Sleeper rules

- **One** background sleeper at a time; kill on done, stop, or merge.
- `notify_on_output` regex: `^AGENT_SHIP_PR_WAKE_<PR>`.
- `dry-run`: no sleeper; re-collect immediately between simulated iterations.

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "No comments yet — skip 5m" | First 5m is mandatory for review Action. |
| "Use goal-fix-pr 2m" | ship-pr always **300s**. |
| "Merge with open threads" | Merge only when `activeThreads == 0`. |
| "Squash without asking" | Use `--merge` (merge commit), matching repo history. |
