# fix-pr — README

Cooperative PR thread resolution skill for **GitHub** and **Azure DevOps**.

Merged from the former `solve-pr` (GitHub) and `08-fix-pr` (Azure DevOps) skills.

## Dependencies

| Resource | Path |
|----------|------|
| Main skill | `.agents/skills/08-fix-pr/SKILL.md` |
| Convergence loop | `.agents/skills/09-goal-fix-pr/SKILL.md` — `/goal-fix-pr <PR-ID>` |
| Code review (pre-push) | `.agents/skills/06-code-review/SKILL.md` |
| GitHub commands | `gh pr view --json comments` (fetch), `gh api .../replies` (resolve) |
| Azure DevOps script | `.agents/skills/08-fix-pr/scripts/fix_pr_azure_context.py` |
| Azure DevOps config | `.agents/skills/azure-devops/azure-devops.config.json` |

## Platform support

| Platform | Commands | Auth |
|----------|---------|------|
| **GitHub** | `gh pr view --json comments` (fetch), `gh api .../replies` (resolve) | `AGENTIC_CODE_REVIEWERS_GITHUB_TOKEN` / `GITHUB_TOKEN` / `GH_TOKEN` |
| **Azure DevOps** | `fix_pr_azure_context.py` collect + resolve-thread | `AZURE_DEVOPS_PAT` or `.azure-devops/azure-devops.secret` |

## Flow summary

1. Branch sync + CI check (step 0)
2. Fetch open threads (platform-specific script)
3. Thread scoring (0–10 urgency scale)
4. Confirmation gate (user approves plan)
5. Execution plan (`plan-exec.md`)
6. Fix code (Score > 5) or resolve with comment (Score ≤ 5)
7. Validate (build + test + auto-review)
8. Report (`.cursor/codereviews/PR-XXX-round-N.md`)
9. Resolve threads on platform + commit + push

## Thread scoring

| Score | Urgency | Action |
|-------|---------|--------|
| 0–2 | Low | Resolve without code |
| 3–5 | Low | Resolve without code |
| 6–8 | High | Fix in code |
| 9–10 | High | Fix in code (critical) |

## Checklist per fix

- Surgical changes only (Karpathy guidelines)
- Fix defect class, not just instance
- Validate with `dotnet test` / `npm test` / `npm run build`
- Auto-review with `code-review` skill before push
- Report in `.cursor/codereviews/`
- Resolution comment with `<!-- resolution-reply -->` marker
