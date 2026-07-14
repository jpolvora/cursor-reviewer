# Domain review report template

Default language: **English (US)**. Copy into the reply (or `.cursor/codereviews/domain-{slug}-YYYY-MM-DD.md` if user wants a file).

```markdown
## Domain review — {slug}[ / {subdomain}]

**Catalog:** specs/domains/index.md
**Contract:** specs/domains/{slug}.md
**Perimeter:** [1–2 lines from Front-End/Back-End scope]
**Out of scope:** [Not included + neighbor notes]
**Paths reviewed:** [N files — list or glob summary]
**Lenses:** dotnet-sec/perf (required BE) · boundaries · smells · gaps · security · perf · SOLID/DRY · enhancements
**Sub-skill:** `.agents/skills/dotnet-security-performance-review/SKILL.md` applied on BE: yes | N/A (FE-only)

### Summary
- Critical: N
- Warning: N
- Top risk: …
- Top strength: …

### Findings

| Sev | ID | Area | Location | Finding | Explanation | Fix |
|-----|----|------|----------|---------|-------------|-----|
| Critical | C1 | Security | `path:line` | … | why it matters | concrete step |
| Warning | W1 | Perf | `path:line` | … | why it matters | concrete step |

*Sev = Critical | Warning only in this table. Suggestions go under Enhancements.*

### Fix plan

Ordered; every C* and W* ID appears once.

1. **[C1]** … → verify: …
2. **[W1]** … → verify: …
3. …

### Enhancements (optional)
| ID | Idea | Why | Effort |
|----|------|-----|--------|
| E1 | … | … | S/M/L |

### Deferred / unknown
Checklist or map items not verified this pass (explicit — never silent).

### Next
Apply fixes? Reply with `YES` (all) or `YES C1 W2` (subset).

*If invocation included `auto`: skip this ask — apply all C/W and continue [AUTO.md](AUTO.md).*
```

## Stamp on domain file (mandatory)

After the chat report, replace or insert this section on `specs/domains/{slug}.md` — place **after** `## Specs & ADRs` and **before** `## Dependências` (create Specs & ADRs first if missing).

```markdown
## Last review

| Field | Value |
|-------|-------|
| Date | YYYY-MM-DD |
| Skill | [domain-review](../../.agents/skills/domain-review/SKILL.md) |
| Critical / Warning | N / M |
| Specs & ADRs (existing) | [Title](../path/to/spec.md); … — or `No file found` |

*Automatically updated upon completing a domain review. Counts = report Summary.*
```

Rules:

- **Date** = session date from user_info (do not invent). Always refresh on every completed review (including `next` re-reviews) so rotation by oldest date works.
- **Specs & ADRs (existing)** = links from that domain's `## Specs & ADRs` (plus extras actually opened) whose target file exists; drop broken links; keep relative paths as in the domain file.
- Do **not** edit product specs under `docs/superpowers/specs/` or `specs/*.spec.md` for this stamp — only the domain map file.
- Under **`auto`**, stamp **after** fixes with post-fix Critical/Warning counts.

## Severity

| Sev | Use for |
|-----|---------|
| **Critical** | Tenancy leak, authz hole, funds/integrity bug, data loss, Core layer leak that enables wrong writes |
| **Warning** | Missing tests on money/auth paths, N+1, pattern drift likely to bite, checklist gap, DRY smell with real cost |
| **Enhancement** | Nice-to-have standardization, optional pattern — not in Critical/Warning table |

Nothing found in a severity → write `None` in Summary counts; keep empty Findings table or one row `— | — | — | — | None | — | —`.
