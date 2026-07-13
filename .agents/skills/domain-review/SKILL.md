---
name: domain-review
description: >
  Use when the user asks for domain review, bounded-context review, code-review by domain,
  subdomain audit, or to pick a domain from specs/domains for smells/security/SOLID/perf.
  Also when they say /domain-review, /domain-review next, /domain-review auto, or
  /domain-review next auto (auto-pick + optional full fix/PR/goal-fix-pr cycle).
---

# Domain review

On-demand Layer 2. **Not** PR/branch review ([code-review](../06-code-review/SKILL.md)). Extra OWASP depth → [security-review](../security-review/SKILL.md).

**REQUIRED SUB-SKILL (BE):** [dotnet-security-performance-review](../dotnet-security-performance-review/SKILL.md) on every review that touches `src/`. Fold findings into [REPORT.md](REPORT.md) Critical/Warning + fix plan (not that skill's 4-section report).

**Catalog:** [`specs/domains/index.md`](../../../specs/domains/index.md). **`auto` pipeline:** [AUTO.md](AUTO.md).

## Parse

```
/domain-review [<slug>] [next] [auto] [dry-run]
```

| Token | Effect |
|-------|--------|
| `<slug>` | Select domain (index). Optional if `next`. |
| `next` | Auto-pick: never reviewed first, else oldest `## Last review` **Date** ([§ next](#next--auto-pick)). No catalog wait. |
| `auto` | After report: apply all C/W → verify → commit → push → PR → [goal-fix-pr](../09-goal-fix-pr/SKILL.md) `max 10`, **5 min** waits ([AUTO.md](AUTO.md)). |
| `dry-run` | With `auto`: simulate git/gh/resolve; no writes. |

Combine: `/domain-review next auto`. Restate: slug|next-pick, auto?, dry-run?.

## Iron rules

1. **Select before investigate.** Catalog + wait — unless message has valid slug/`Pai / Sub`, or **`next`**.
2. **One perimeter.** Domain map + listed fat-page spillover only. Neighbors = Dependências notes unless multi-select.
3. **Read domain `.md` first.** Then code.
4. **Report:** Critical + Warning table, explanations, fix plan for every finding ([REPORT.md](REPORT.md)).
5. **No implement** until user asks — **except `auto`** (= apply all C/W).
6. **Stamp** `## Last review` after report (after fixes when `auto`): today's Date, counts, existing Specs & ADRs only. Re-review via `next` **must** refresh Date.

## next — auto-pick

1. Slugs from index § Índice (main table; not subdomains).
2. Per slug: parse `## Last review` → **Date** (`YYYY-MM-DD`). Missing = never reviewed.
3. Order = index § **Ordem sugerida** (flatten); others append A–Z.
4. Pick: first never-reviewed in that order; else oldest Date (tie → suggested order).
5. Announce `next → {slug} (never | Date YYYY-MM-DD)`; continue. No subdomain auto-pick.

## Workflow

```text
catalog | next → select → domain.md → investigate → report → stamp → stop | AUTO.md
```

1. Catalog or `next`. Confirm perimeter.
2. Contract from domain `.md`; walk BE/FE; BE → dotnet-sec/perf.
3. Report ([REPORT.md](REPORT.md)); stamp.
4. No `auto` → "Apply fixes?". `auto` → [AUTO.md](AUTO.md) (no ask).

**Lenses:** boundaries · smells/DRY · gaps · FE security/perf · SOLID · enhancements · (BE) full dotnet-sec/perf. Optional same-perimeter: [security-review](../security-review/SKILL.md), [tdd-sdd-ddd-reviewer](../tdd-sdd-ddd-reviewer/SKILL.md).

## vs other skills

| Ask | Skill |
|-----|-------|
| Branch/PR vs `master` | [code-review](../06-code-review/SKILL.md) |
| Bounded context / `next` / `auto` | **This** (+ BE sub-skill; `auto` → [AUTO.md](AUTO.md)) |
| All stale/never domains (≥7d batch) | [multi-domain-review](../multi-domain-review/SKILL.md) |
| C# auth/EF/perf only | [dotnet-security-performance-review](../dotnet-security-performance-review/SKILL.md) |
| OWASP exploit paths | [security-review](../security-review/SKILL.md) |
| TDD/SDD/DDD audit | [tdd-sdd-ddd-reviewer](../tdd-sdd-ddd-reviewer/SKILL.md) |

"By domain" + "diff only" → this skill primary; PR diff may prioritize paths, never defines perimeter.

## Rationalizations / red flags

| Excuse | Reality |
|--------|---------|
| Skip index / silent neighbors | Cite catalog; open domain `.md`; one perimeter. |
| `next` = favorite | Algorithm only (never → oldest Date → suggested order). |
| Critical-only / no plan / skip stamp | Table + plan + stamp mandatory. |
| Skip BE sub-skill | Any `src/` path → load it; fold into REPORT. |
| `auto` still ask SIM / skip goal-fix-pr / 2m wait | `auto` = all C/W; [AUTO.md](AUTO.md) always goal-fix-pr + **5m** (incl. first). |

**STOP:** grep before select; multi-domain without multi-select; code-review as primary; BE without sub-skill; missing Warnings/plan/stamp; implement without ask and without `auto`; `auto` without ship when there are changes (unless dry-run).
