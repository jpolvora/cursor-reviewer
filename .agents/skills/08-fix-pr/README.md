# fix-pr — README

Cooperative PR thread resolution skill for **GitHub** and **Azure DevOps**.

Merged from the former `solve-pr` (GitHub) and `08-fix-pr` (Azure DevOps) skills.

Thread list/resolve I/O goes through `config.providers.scm` → [github-provider](../github-provider/SKILL.md) or [azure-devops-provider](../azure-devops-provider/SKILL.md). Prefer those skills’ intents and canonical scripts; do not treat a single host CLI as the only happy path.

## Dependencies

| Resource | Path |
|----------|------|
| Main skill | `.agents/skills/08-fix-pr/SKILL.md` |
| Convergence loop | `.agents/skills/09-goal-fix-pr/SKILL.md` — `/goal-fix-pr <PR-ID>` |
| Code review (pre-push) | `.agents/skills/06-code-review/SKILL.md` |
| SCM config | `providers.scm` in `.agents/skills/spec-to-pr/config.json` (`github` \| `azure-devops`) |
| GitHub provider | `.agents/skills/github-provider/SKILL.md` — `list-threads` / `resolve-thread` |
| Azure DevOps provider | `.agents/skills/azure-devops-provider/SKILL.md` — `list-threads` / `resolve-thread` |
| GitHub list (canonical) | `.agents/skills/github-provider/scripts/fetch_threads.cjs` |
| GitHub resolve (canonical) | `.agents/skills/github-provider/scripts/resolve_thread.cjs` |
| Azure DevOps collect/resolve (canonical) | `.agents/skills/azure-devops-provider/scripts/fix_pr_azure_context.py` |
| Legacy shims (forward only) | `.agents/skills/08-fix-pr/scripts/fetch_threads.cjs`, `resolve_thread.cjs`, `fix_pr_azure_context.py` |

## Platform support

| Platform | How (via `providers.scm`) | Auth |
|----------|---------------------------|------|
| **GitHub** (`scm: github`) | Provider intents `list-threads` / `resolve-thread` → canonical `fetch_threads.cjs` / `resolve_thread.cjs` | `AGENTIC_CODE_REVIEWERS_GITHUB_TOKEN` / `GITHUB_TOKEN` / `GH_TOKEN` (+ `gh` for CLI flows) |
| **Azure DevOps** (`scm: azure-devops`) | Provider intents `list-threads` / `resolve-thread` → canonical `fix_pr_azure_context.py` collect / resolve-thread | PAT via `issueTrackers.azureDevOps.patEnvVar` → `ADO_PAT` → `AZURE_DEVOPS_PAT` |

Shims under `08-fix-pr/scripts/` re-exec the provider scripts; new work should call the provider skill or canonical paths.

## Flow summary

1. Branch sync + CI check (step 0)
2. Resolve `providers.scm` → fetch open threads (`list-threads`)
3. Thread scoring (0–10 urgency scale)
4. Confirmation gate (user approves plan)
5. Execution plan (`plan-exec.md`)
6. Fix code (Score > 5) or resolve with comment (Score ≤ 5)
7. Validate (build + test + auto-review)
8. Report (`.cursor/codereviews/PR-XXX-round-N.md`)
9. Resolve threads via scm provider (`resolve-thread`) + commit + push

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
