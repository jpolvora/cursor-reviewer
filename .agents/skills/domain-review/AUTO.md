# Domain review — `auto` pipeline

Runs after the domain report when invocation includes **`auto`**. Interactive domain-review stops at "Apply fixes?"; **`auto` skips that gate**.

Load this file only when `auto` is set. Parent: [SKILL.md](SKILL.md). Convergence: [goal-fix-pr](../09-goal-fix-pr/SKILL.md) + [fix-pr](../08-fix-pr/SKILL.md).

## Preconditions

- Domain selected (slug or `next`).
- Report + fix plan exist for this turn (Critical/Warning table).
- `gh` auth OK for push + `gh pr create` (unless `dry-run`).
- Working tree: prefer clean base before starting fixes; if dirty unrelated files, stop and ask (do not mix).

## Pipeline

```text
report → apply C/W fixes → stamp → verify → commit → push branch → gh pr create → sleep 5m → goal-fix-pr (max 10, 5m between rounds)
```

### 1. Apply fixes

1. Treat `auto` as **YES** for every Critical + Warning ID in the fix plan.
2. Skip Enhancements unless the user also said to include them.
3. Surgical diffs only ([karpathy](../shared/karpathy-guidelines/SKILL.md)); stay inside domain perimeter + necessary tests/docs.
4. If Findings = none → still stamp (refresh **Date**), then skip code commit unless stamp/docs alone warrant a docs PR (prefer one docs commit on the auto branch).

### 2. Stamp

Update `## Last review` on `specs/domains/{slug}.md` with **today's** Date and post-fix Critical/Warning counts (0/0 if all fixed). Required for `next` rotation.

### 3. Verify

Per [AGENTS.md](../../../AGENTS.md) § Verification + [senior-developer](../../../AGENTS.md#external-dependencies) (resolve via `config.json.rules.seniorDeveloper`):

```bash
# Run build/test verification commands configured in config.json.verification
```

Port conflict (5080/5173) → ask before `npm stop`. Fail → fix or stop; do not open PR on red.

### 4. Branch, commit, push

1. Branch from current base (usually `develop` or `master` — match repo default for feature PRs):

   `domain-review/{slug}-YYYY-MM-DD`

2. Stage only domain-review files (code, tests, domain stamp, MEMORY/CHANGELOG if this session wrote them). No secrets / `bin` / `obj`.
3. Commit (user already authorized via `auto` — this is the commit ask):

   ```
   review({slug}): domain-review findings and fixes
   ```

4. `git push -u origin HEAD`.

`dry-run`: print planned branch/message/files; no commit/push.

### 5. Create PR

```bash
gh pr create --title "review({slug}): domain-review fixes" --body "$(cat <<'EOF'
## Summary
- Domain-review auto pass for `{slug}` (catalog: specs/domains/index.md).
- Applied Critical/Warning fix plan; stamped `## Last review`.

## Test plan
- [ ] Run verification tests (backend build & test, frontend build & test if applicable)
- [ ] Spot-check perimeter paths listed in the review report

EOF
)"
```

Capture **PR number** from URL/`gh pr view --json number`. If PR already exists for this head → use that number (do not open a duplicate).

`dry-run`: skip `gh pr create`; use placeholder `PR-NUMBER=0` and stop before goal-fix-pr, or simulate one collect only.

### 6. goal-fix-pr (max 10, 5 minute waits)

Overrides vs stock [goal-fix-pr](../09-goal-fix-pr/SKILL.md):

| Stock goal-fix-pr | Under domain-review `auto` |
|--------------------|----------------------------|
| Default max **20** | **`max 10`** |
| Post-push / re-collect wait **2 min** | **5 min (300s)** |
| Iteration 1 runs immediately after first collect | **First goal-fix-pr act also waits 5 min** (give GitHub Action / agentic code review time to comment) |

Loop:

1. `PR=<number from step 5>`.
2. **Sleep 300s** (first wait before any fix-pr act). Sentinel:

   ```bash
   sleep 300
   echo 'AGENT_DOMAIN_REVIEW_AUTO_WAKE_pr_<PR> {"reason":"pre-review-wait","prompt":"Start goal-fix-pr <PR> max 10 under domain-review auto"}'
   ```

3. Load [goal-fix-pr](../09-goal-fix-pr/SKILL.md) with `/goal-fix-pr <PR> max 10`. Apply its automation overrides (auto plan gate, auto commit/resolve/push).
4. Replace that skill's **120s** heartbeat with **300s** for every post-push / between-round wait in this auto session. Same single-sleeper rule; sentinel prefix:

   `AGENT_DOMAIN_REVIEW_AUTO_WAKE_pr_<PR>`

5. Stop when `activeThreads == 0`, `n >= 10`, escalate-only threads, user stop, or GitHub collect fails.

### 7. Final report

1. Slug + next-pick reason (if any).
2. Critical/Warning before → after.
3. Branch, commit hash(es), PR URL.
4. goal-fix-pr iterations + final `activeThreads`.
5. Code review proof ([senior-developer](../../../AGENTS.md#external-dependencies)) + Learning + Changelog.

## Combinations

| Invocation | Behavior |
|------------|----------|
| `/domain-review next` | Auto-pick → report → stamp → stop (ask Apply?) |
| `/domain-review auto identity-access` | That slug → report → full pipeline |
| `/domain-review next auto` | Auto-pick → report → full pipeline |
| `/domain-review next auto dry-run` | Auto-pick → report → simulate pipeline |

## Stop / escalate

| Condition | Action |
|-----------|--------|
| Verify red 3× same failure | Stop; no PR |
| Dirty unrelated tree | Stop; ask user |
| goal-fix-pr **Escalar** | Stop; list thread IDs |
| `n >= 10` | Stop; report remaining threads + PR URL |
| User says stop | Kill sleeper; summarize |

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "Skip 5m first wait — no CI yet" | First 5m is mandatory for GH review Action. |
| "Use goal-fix-pr 2m default" | Auto domain-review always 5m. |
| "max 20 is fine" | Cap **10** under this pipeline. |
| "No findings — skip stamp" | Stamp anyway (Date refresh for `next`). |
| "Commit without auto / user ask" | Only `auto` (or later explicit ask) authorizes commit/push/PR. |
