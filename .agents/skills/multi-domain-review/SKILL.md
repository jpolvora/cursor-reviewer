---
name: multi-domain-review
description: >
  Use when the user asks to review multiple domains, batch domain-review, rotate all
  stale/never-reviewed domains, or says /multi-domain-review, multi-domain review,
  review all domains, or domain-review queue/batch with the 7-day freshness window.
---

# Multi-domain review

Orchestrator only. Does **not** replace [domain-review](../domain-review/SKILL.md). Each candidate = that skill **`{slug} auto`** ([AUTO.md](../domain-review/AUTO.md)).

**Parent = status coordinator.** One subagent per domain. Parent never reviews code, never runs `auto` inline, never merges perimeters.

## Parse

```
/multi-domain-review [dry-run] [max N] [continue-on-error]
```

| Token | Effect |
|-------|--------|
| *(none)* | Enumerate → **execute** serial queue (full `auto` each). Default is **not** dry-run. |
| `dry-run` | Print queue only; no subagents, no git/merge. **Only** when this token present. |
| `max N` | Process at most N candidates; rest listed remaining. Default = all. |
| `continue-on-error` | After child hard-fail, continue queue (default = **stop queue**). |

## Candidate rule (7 days)

`age_days = today − Date` (calendar days). `cutoff = today − 7` (example: today `2026-07-08` → cutoff `2026-07-01`).

1. Slugs from [`specs/domains/index.md`](../../../specs/domains/index.md) § Index **main table only** (not Subdomains).
2. Per slug: `specs/domains/{slug}.md` → `## Last review` → **Date** (`YYYY-MM-DD`). Missing = never reviewed.
3. **Enqueue** if never reviewed **OR** `age_days >= 7` (equiv. `Date <= cutoff`).
4. **Skip** if `age_days < 7` (equiv. `Date > cutoff`). Example today `2026-07-08`: Date `2026-07-02`…`08` skip; Date `2026-07-01` or earlier enqueue.
5. **Order:** § Suggested order (flatten); leftovers A–Z. No risk-weight, no “tonight” reorder.

Announce full queue + skipped-fresh list **before** first spawn.

## Iron rules

1. **Enumerate first.** Materialize candidates before any child. Orchestrator must **not** drive batch via `next`.
2. **Serial only.** One in-flight `auto` at a time. Never parallel `auto`.
3. **One slug per subagent.** `/domain-review {slug} auto` (+ parent `dry-run` only if parent has `dry-run`). Never `next`. Never multi-slug child.
4. **Wait finish.** Block until child done (incl. AUTO stamp/verify/PR/**goal-fix-pr max 10 / 5m**). Then **between-domain handoff** (below) before next spawn.
5. **Coordinator rows.** After each child: slug, PR, C/W before→after, `activeThreads`, merge SHA, pass/fail.
6. **No parent AUTO.** Parent does not fix, commit, or goal-fix-pr. Parent **does** run handoff git/gh after `activeThreads == 0`.

## Workflow

```text
index → stamps → filter (never | Date <= cutoff) → order → dry-run? stop : max N
  → for each: spawn(domain-review {slug} auto) → wait → handoff → status
  → rollup
```

### Between-domain handoff (required when queue continues)

Runs on **parent** after child reports `activeThreads == 0` (and not dry-run). **Base branch = `master`** (`origin/HEAD`).

```text
activeThreads == 0 → approve+merge PR → checkout master → pull → (if more in queue) new branch for next slug
```

1. **Merge PR** (approve + merge into `master`):

   ```bash
   gh pr review <PR> --approve
   gh pr merge <PR> --merge --delete-branch
   ```

   If already merged, continue. If merge blocked (checks/reviews/conflicts): **stop queue**, report PR URL + blocker (unless `continue-on-error` — then skip handoff for this slug and note dirty base risk).

2. **Sync local `master`:**

   ```bash
   git fetch origin
   git checkout master
   git pull origin master
   ```

   Clean tree required. Conflicts → stop queue; ask user.

3. **Next work branch** — only if more candidates remain after `max N` / stop rules:

   ```bash
   git checkout -b domain-review/{next-slug}-YYYY-MM-DD
   ```

   Then spawn next child (`/domain-review {next-slug} auto`). Child AUTO may recreate/reuse that branch name; starting from updated `master` is mandatory so next PR is not based on the previous domain branch.

4. **Last candidate** — after merge + pull `master`, **do not** create a leftover feature branch unless user asked. Stay on `master` (or report done).

`dry-run`: print planned `gh pr merge` / pull / next branch; no writes.

### Subagent prompt (required)

1. Load `.agents/skills/domain-review/SKILL.md` + `AUTO.md`
2. Run `/domain-review {slug} auto` (add `dry-run` iff parent dry-run)
3. Honor AUTO dirty-tree stop
4. Return: slug, C/W before→after, branch, PR URL/number, goal-fix-pr iterations + final `activeThreads`, stop reason

### Queue stop

| Condition | Action |
|-----------|--------|
| Child verify-red / dirty tree / goal-fix-pr **Escalar** | Record fail; **stop queue** unless `continue-on-error` |
| Merge/pull handoff blocked | **Stop queue** unless `continue-on-error` |
| `max N` hit | Stop; list remaining |
| User stop | Kill in-flight; summarize |
| Parent `dry-run` | Print queue; exit (no execute) |

## vs other skills

| Ask | Skill |
|-----|-------|
| One domain / `next` / single `auto` | [domain-review](../domain-review/SKILL.md) |
| All stale/never (7-day window) batch | **This** |
| PR threads only | [goal-fix-pr](../09-goal-fix-pr/SKILL.md) |

## Rationalizations / red flags

| Excuse | Reality |
|--------|---------|
| "`next auto` loop is enough" | Enumerate + `{slug} auto`. `next` ≠ this skill. |
| "Parallel waves / batch = concurrent" | Serial only. "Batch" = queue, not parallel git. |
| "Default dry-run to be safe" | Default = **execute**. `dry-run` only if token set. |
| "Cutoff day still fresh" | `age_days >= 7` / `Date <= cutoff` → **enqueue**. Only `age_days < 7` skips. |
| "Mega-agent for small domains" | One slug per child. |
| "Cap/risk-order for tonight" | Full queue unless user `max N`. |
| "Parent auto inline" | Coordinator only (except handoff git/gh). |
| "Time-box / skip 5m / start next early" | Wait full AUTO + goal-fix-pr. |
| "Threads clear — skip merge, spawn next" | **Handoff required:** approve+merge → pull `master` → new branch if queue remains. |
| "Git ceremony wastes time" | Without merge+pull, next domain branches from stale/wrong base. |
| "Leave PR open; merge later" | Batch owns merge when `activeThreads == 0` before next domain. |

**STOP:** parallel auto; `next` as batch driver; multi-domain child; parent inline auto; skip enumerate; skip `Date == cutoff` (age 7 must enqueue); invent default dry-run; silent risk reorder; continue after escalate without `continue-on-error`; spawn next domain while previous PR still open/unmerged; skip `git pull origin master` before next branch.
