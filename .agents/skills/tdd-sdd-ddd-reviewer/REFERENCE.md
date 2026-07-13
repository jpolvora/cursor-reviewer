# TDD / SDD / DDD Reviewer — Reference

Backend (.NET/C#) and frontend (React/TypeScript) audit criteria. **Project-agnostic:** resolve assembly names, layer layout, and tenancy rules from the consumer's `senior-developer` skill, `CONTEXT.md`, and `stack.md` — do not assume a fixed solution name.

---

## Project conventions (check senior-developer first)

Load authoritative conventions from [senior-developer](../senior-developer/SKILL.md) and project docs before applying generic DDD advice.

| Area | Typical rule (resolve names from project docs) |
|------|-----------------------------------------------|
| **Entities** | EF-mapped `class` entities in the domain/core assembly with public `{ get; set; }` when EF requires it — **not** `record` entities |
| **DTOs** | `public record` in the core DTOs namespace (primary-constructor records OK) |
| **EF** | `IEntityTypeConfiguration<>` in Infrastructure; CLI migrations only — no hand-written migrations |
| **Layers** | Core ← Infrastructure ← Api; domain logic in Infrastructure services implementing Core interfaces |
| **CQRS / MediatR** | Only flag if the project spec requires it — do not mandate MediatR by default |
| **Tenancy** | Follow project global filters and documented platform/admin bypass paths |
| **API** | RFC 7807 `ProblemDetails`; secrets from environment |
| **Tests** | New behavior + bug fixes need tests per senior-developer; tenant isolation on cross-tenant paths |
| **Frontend i18n** | Follow project locale policy when strings change |
| **Frontend fetch** | Reuse existing auth/list hooks documented in the consumer project |

---

## TDD / SDD / DDD rules

### SDD (spec-driven design)

- Changed behavior must match the relevant spec under `docs/superpowers/specs/`.
- Domain terms in code/comments match [`CONTEXT.md`](../../../CONTEXT.md) (glossary only — do not duplicate product rules there).

### DDD (project-aligned)

- **Separation:** Core/domain assembly has zero references to Infrastructure, EF, or ASP.NET.
- **Entities:** EF-mapped `class` entities; validation/business invariants in services or dedicated validators — do not require private setters on EF entities.
- **Services:** Infrastructure implements core interfaces; controllers stay thin.
- **Domain events:** Use existing project audit/event patterns — do not introduce new event buses without spec.

### TDD

- **Testability:** Flag static time, hidden singletons, or DB-in-constructor patterns that block unit/integration tests.
- **Frontend:** Prefer `@testing-library/react` queries by role/label; avoid testing implementation details.

### React frontend alignment

- **Contracts:** TS types match backend DTOs (`AuthDtos`, cursor list payloads, etc.).
- **Hooks:** Reuse documented hooks and layout patterns from the consumer project's frontend standards skill for new screens.
- **State:** Clear loading/error handling in fetch paths; flag stale `useEffect` closures when they cause bugs.

---

## Backend audit criteria (C# .NET)

Apply within the [code-review](../06-code-review/SKILL.md) touch set (whole changed files + one-hop references). Flag systemic layer violations even outside the diff hunk.

### Modern syntax (suggestions on touched code)

- Prefer collection expressions `[1, 2]` over verbose `new List<int> { … }` when editing nearby code.
- Prefer file-scoped namespaces when creating new files.
- DTOs: keep `public record`; do not convert entities to `record`.

### Performance and memory

- Flag LINQ over-enumeration (`.Any()` then loop on same `IEnumerable`).
- Suggest `Span<T>` only for hot paths — not drive-by refactors.
- `sealed` on new middleware/services is a nice-to-have, not a review blocker.

### Async / await

- **No** `async void` except UI/event handlers.
- **No** `.Result`, `.GetAwaiter().GetResult()`, or `.Wait()` on async paths.
- New/changed API actions should accept and propagate `CancellationToken`.
- **ConfigureAwait:** Do not require `.ConfigureAwait(false)` in ASP.NET Core app code (Api/Infrastructure hosted services). Optional in portable library code outside this repo.

### DI and quality

- Flag captive dependencies (Singleton injecting Scoped `DbContext`).
- NRT compliance on new/changed code paths.
- `using var` for short-lived disposables.

### Defensive security (architecture angle)

- EF: LINQ or `FromSqlInterpolated` only — no string-concat SQL.
- `RandomNumberGenerator` for security tokens — not `System.Random`.
- No hardcoded secrets — use `IConfiguration` / env.

For exploit-focused review, use [security-review](../security-review/SKILL.md).

---

## Frontend audit criteria (React and TypeScript)

- **No `any`** on props, API responses, or state touched by the diff.
- **`useMemo` / `useCallback`:** Flag only when missing memo causes measurable re-render bugs or unstable deps — not blanket requirements.
- **Data fetching:** Loading, error, and empty states handled; align with existing hooks named in project docs.
