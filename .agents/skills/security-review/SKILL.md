---
name: security-review
description: Security code review for vulnerabilities. Use when asked to "security review", "find vulnerabilities", "check for security issues", "audit security", "OWASP review", or review code for injection, XSS, authentication, authorization, cryptography issues. Provides systematic review with confidence-based reporting.
allowed-tools: Read, Grep, Glob, Bash, Task
license: LICENSE
---

# Security Review

Identify exploitable vulnerabilities. Report only **HIGH CONFIDENCE** findings (clear pattern + attacker-controlled input confirmed after codebase research).

## Research vs reporting

- **Report on:** file/diff the user provided
- **Research:** whole codebase to trace data flow before flagging

Before reporting: trace input source; check validation/middleware; read config. No pattern-only flags.

## Confidence

| Level | Action |
|-------|--------|
| **HIGH** | Vulnerable pattern + attacker input confirmed → **report** |
| **MEDIUM** | Pattern present, input unclear → **Needs verification** |
| **LOW** | Theoretical / defense-in-depth → **do not report** |

Skip: test files (unless requested), dead code, server-controlled config (`settings`, env, constants), framework-default escaping/parameterization unless bypassed.

## Process

1. **Detect context** — load matching refs from [REFERENCE.md](REFERENCE.md) § Reference index (`references/`, `languages/`, `infrastructure/`).
2. **Multi-tenant isolation** — verify tenancy filters, company-scoped queries, authz on admin/platform routes; treat unvetted `IgnoreQueryFilters()` as review focus (bg jobs OK when row carries scoping field).
3. **Verify exploitability** — attacker-controlled vs server-controlled (see REFERENCE § Input sources).
4. **Report HIGH only** — severity table and output template in [REFERENCE.md](REFERENCE.md) § Output format.

If none: "No high-confidence vulnerabilities identified."

## Quick always-flag (investigate first)

`eval`/`exec` on user input, unsafe deserialize, SQL/command string concat with user input, hardcoded secrets, `dangerouslySetInnerHTML` / `v-html` / `|safe` with user data. SSRF/open redirect/path traversal only when URL/path comes from the request, not settings.

Full pattern lists: [REFERENCE.md](REFERENCE.md).
