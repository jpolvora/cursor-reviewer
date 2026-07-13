# Stack Definition — US Workflow

Human-readable companion to `config.json`. Agents read config.json for machine-readable values; this doc explains the structure and conventions.

> **Source of truth:** `.agents/skills/spec-to-pr/config.json` — project identity, stack, verification commands, invariants. `tools.md` — canonical tool aliases. This `stack.md` is the human-readable guide.

## Project Stack (from config.json)

Stack is defined in `config.json.stack`:
- **Backend:** `backend.framework` (`backend.language`) — layers defined in `backend.layers[]` (each with `name`, `path`, `role`)
- **Frontend:** `frontend.framework` — source in `frontend.sourceDir`, i18n in `frontend.i18n`
- **Database:** `database.type` via `database.orm` — migrations project at `database.migrationsProject`
- **Domain:** `domain.model` with `domain.tenancyField`
- **Orchestration:** dev/start/stop commands in `orchestration`

API host: `backend.apiHost` · Dev server: `frontend.devHost`

## Code Paths (mutating steps)

Layers from `config.json.stack.backend.layers[]`, frontend from `frontend.sourceDir`, tests from `backend.testProject`.

| Layer | Path | Role |
|-------|------|------|
| **{layer.name}** | `{layer.path}` | `{layer.role}` |
| **Frontend** | `{frontend.sourceDir}` | Pages, components, routes, i18n |
| **Tests** | `{backend.testProject}` | Unit + integration |
| **Scripts** | `scripts/` | Dev helpers, seed |

**Dry-run / isolation:** Steps 5 and 10 mutate source paths only when implementing code. Step 11 is integration validation (read/execute checks; no feature implementation).

## Validation Commands (from config.json)

Used by orchestrator and subagents for build/test validation (Steps 7, 10, 11 §3).

Tool aliases defined in `tools.md`. Actual commands in `config.json.verification`:

| Layer | Tool alias | Config key | Notes |
|-------|-----------|------------|-------|
| **Backend** | `build-backend` | `verification.backendBuild` | Compile |
| **Backend** | `test-backend` | `verification.backendTest` | Unit + integration |
| **Backend** | `lint-backend` | `verification.backendFormat` | Style check |
| **Frontend** | `build-frontend` | `verification.frontendBuild` | Compile |
| **Frontend** | `test-frontend` | `verification.frontendTest` | Run when i18n/UI logic touched |
| **Migrations** | `migrations-add` | `verification.migrationsAdd` | Never hand-write migration files |
| **Migrations** | `migrations-apply` | `verification.migrationsApply` | Before API/UI integration tests |
| **Seed** | `seed-db` | `database.seedScript` | Local demo dataset |
| **Full stack** | `compose-up` | `orchestration.composeCommand` | Docker full stack |

**When frontend not modified:** skip frontend build/test.
**When `skipTests: true`:** skip test rows only; build still runs.

> **Running dev stack:** if build/test fails with **address already in use**, the stack may already be running. **Ask the user** before stopping — never stop their environment without consent.

## Project Rules & Skills (from config.json)

Paths to guidelines that subagents must follow. Read from `config.json.rules`:

| Area | Config key | Notes |
|------|-----------|-------|
| **Harness routing** | `rules.harness` | Hub (usually `AGENTS.md`) |
| **Engineering guardrails** | `rules.seniorDeveloper` | Entities, EF, migrations, tests |
| **Karpathy guidelines** | `rules.karpathyGuidelines` | Surgical changes, simplicity |
| **UI patterns** | `rules.viewPatterns` | List/form/CRUD conventions |
| **Architecture spec** | `domain.architectureSpec` | API, tenancy, auth design |
| **Glossary** | `domain.glossaryFile` | Domain terms |
| **Design tokens** | `domain.designTokens` | UI tokens, colors |

Delegated workflow skills (Steps 1–11) live under `.agents/skills/` — see `SKILL.md` § Allowed dependencies.

## Project Invariants (from config.json)

Enforced by code review and validation. Read from `config.json.invariants`:

| Key | Rule |
|-----|------|
| `entitiesAreClassNotRecord` | Entities are `class`, not `record` |
| `migrationsCliOnly` | Migration files never hand-written |
| `tenancyViaGlobalQueryFilters` | Tenant isolation via query filters |
| `efOnlyInInfrastructure` | EF references only in infrastructure layer |
| `noInlineHandWrittenMigrations` | No manual migration file edits |
| `commitPlanFilesOnlyAtStep12` | Plan files committed only at Step 12 delivery |

Add project-specific invariants as needed.

## Code Review Diff Scope (Step 9)

Scoped diff vs base branch — exclude generated/cache paths:

```bash
git diff {base_branch}...HEAD -- \
  'src/**' 'web/src/**' 'tests/**' \
  ':!**/bin/**' \
  ':!**/obj/**' \
  ':!web/node_modules/**' \
  ':!web/dist/**'
```

## Dynamic Environment Detection

| Setting | Detection |
|---------|-----------|
| **Base branch** | `git rev-parse --verify master >/dev/null 2>&1 && echo master \|\| echo main` |
| **Git remote** | `config.json.project.gitRemote` (default: `origin`) |
| **Working branch** | `config.json.project.workingBranch` (default: `develop`) — ship-pr / Step 13 head |
| **Base branch** | `config.json.project.baseBranch` (`main` or `master`) |
| **Frontend changed** | Any path under `frontend.sourceDir` in `files_touched` or `git diff` |
| **API running** | Port `backend.apiPort` listen → ask user before stopping |
| **Dev server running** | Port `frontend.devPort` listen → required for Step 11 browser |
