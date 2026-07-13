# ship-pr — examples

## 1. Standard delivery (develop → master)

```
/ship-pr feat(flags): legacy product_analytics wire compat
```

1. On `develop`; `detect-base-branch.sh` → `master`
2. Code-review auto-fix until **Sem feedback** (≤3 rounds)
3. `./scripts/verify.sh` → green
4. Commit → `git push origin develop`
5. `gh pr create --head develop --base master`
6. Sleep 5m → `/goal-fix-pr 39 max 10` (5m heartbeats)
7. `gh pr merge 39 --merge` (keep `develop`)

**PR:** https://github.com/jpolvora/matrix/pull/39

## 2. Dry-run

```
/ship-pr fix(auth): token refresh dry-run
```

Prints base branch, review plan, verify scope, PR body — no writes.

## 3. Ship without merge

```
/ship-pr chore(ci): pin api image sha no-merge
```

Stops after goal-fix-pr convergence; PR stays open.

## 4. Override base (rare)

```
/ship-pr hotfix: emergency base=main max 5
```

Only when default detection is wrong; still push from `develop` unless user explicitly changes head.
