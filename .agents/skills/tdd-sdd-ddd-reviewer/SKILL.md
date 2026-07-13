---
name: tdd-sdd-ddd-reviewer
description: >
  Architectural audit (TDD, spec-driven design, DDD) for C# .NET backends and React frontends.
  Use when explicitly asked for clean-architecture, layer-boundary, or TDD/DDD review — not default PR review.
---

# TDD / SDD / DDD Code Reviewer

On-demand Layer 2 skill per [`AGENTS.md`](../../../AGENTS.md) § Skill loading. **Does not replace** [code-review](../06-code-review/SKILL.md) or auto-loaded [senior-developer](../senior-developer/SKILL.md).

## Precedence

1. User message
2. Design spec → [senior-developer](../senior-developer/SKILL.md) (EF, tenancy, tests)
3. [karpathy-guidelines](../spec-to-pr/extra-skills/karpathy-guidelines/SKILL.md) (surgical diffs — no drive-by rewrites)
4. This skill (layer boundaries, testability, async/DI patterns)
5. [security-review](../security-review/SKILL.md) for OWASP / exploit paths

| Task | Use |
|------|-----|
| PR / branch review, bugs, tenancy | [code-review](../06-code-review/SKILL.md) |
| OWASP, authz, injection | [security-review](../security-review/SKILL.md) |
| Layer boundaries, testability, DDD/TDD audit | **This skill** |

**Scope:** same touch set as [code-review](../06-code-review/SKILL.md) (whole changed files + one-hop references). Style modernization is **suggestion** unless it blocks layer boundaries or testability.

## Quick start

1. Identify diff or files to review (`git diff master...HEAD -- path`).
2. Apply project guardrails in [REFERENCE.md](REFERENCE.md).
3. Apply generic TDD/SDD/DDD checks in [REFERENCE.md](REFERENCE.md).
4. Output findings per format below. Offer surgical snippets — **not** full-file rewrites unless user asks.

## Workflows

### Architectural audit

- **SDD (spec-driven design):** behavior matches locked design spec; API/domain terms align with [`CONTEXT.md`](../../../CONTEXT.md).
- **DDD:** `Core` has no Infrastructure/API references; business rules in services, not controllers; thin controllers.
- **TDD:** logic testable without hidden globals/`DateTime.UtcNow`; frontend tests query by accessibility role.

### Checklists

See [REFERENCE.md](REFERENCE.md): project conventions, backend (async, DI, EF), frontend (types, hooks, fetching).

## Output format

Default language: **Portuguese (Brazil)** unless user asks English.

```markdown
### Architectural & strategic concerns
*(DDD/TDD/SDD layer or spec mismatches. If none: "Nenhum identificado.")*

### Findings by file
* **[path / class]**:
  * **Critical** (layer leak, deadlock, untestable core logic): …
  * **Warning** (performance, DI lifetime, missing CancellationToken): …
  * **Suggestion** (readability, optional modern syntax on touched lines): …

### Suggested patches
*(Minimal diffs for Critical/Warning only — karpathy-sized. Omit if review-only.)*
```

If nothing to fix: **Sem feedback**.

For security findings, defer to [security-review](../security-review/SKILL.md) format.
