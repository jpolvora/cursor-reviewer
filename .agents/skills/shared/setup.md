# Setup & Bootstrap — Shared Workflow Entry

Initialization, configuration bootstrap, flags, resume logic, and first-run setup.
Shared by [`spec-to-pr`](../spec-to-pr/SKILL.md) and [`spec-to-pr-lite`](../spec-to-pr-lite/SKILL.md).

Artifact paths: [`../spec-to-pr/ARTIFACTS.md`](../spec-to-pr/ARTIFACTS.md). Resume rules in this file are canonical; FAQ/DIAGRAM must link here.

---

## Bootstrap & Entry

> **[spec-to-pr]** — Before Step 0.
> **[spec-to-pr-lite]** — Before Step 1.

1. **Config check**: Check if `.agents/skills/shared/config.json` exists. If missing:
   - `cp .agents/skills/shared/config.json.example .agents/skills/shared/config.json`
   - AskQuestion: **Fill config now** / **Skip**
   - If "Fill now": present each top-level section, collect values. Skip optional sections.
1a. **AskQuestion gate rule (recommended)**: If `.cursor/rules/ask-question-gates.mdc` is missing and `.agents/skills/spec-to-pr/cursor-rules/ask-question-gates.mdc` exists, copy it into `.cursor/rules/` so Agent chat always forces native `AskQuestion` for selectable gates (see orchestrator `SKILL.md` § AskQuestion requirement).
1b. **Stack file bootstrap**: Read `config.json.rules.stackFile` (default: `STACK.md`). `Shell` `test -f {stackFile}`. If missing:
   - Auto-detect the project stack by scanning the repository:
     - **Language/Framework**: Look for `package.json` (Node/React/Next), `*.csproj`/`*.sln`/`*.slnx` (.NET), `pyproject.toml`/`requirements.txt` (Python), `go.mod` (Go), `Cargo.toml` (Rust), `pom.xml`/`build.gradle` (Java), `Gemfile` (Ruby), etc.
     - **Frontend framework**: Check `package.json` `dependencies` for `next`, `react`, `vue`, `angular`, `svelte`, `vite`, `tailwindcss`, etc.
     - **Backend framework**: Check for `express`, `fastify`, `nest`, `django`, `flask`, `fastapi` in matching config files.
     - **Database**: Check for `prisma/schema.prisma`, `drizzle.config.*`, `Migrations/`, `alembic/ini`, EF Core migrations, `docker-compose.yml` (PostgreSQL, MySQL, MongoDB images).
     - **Project structure**: List top-level directories (`src/`, `web/`, `tests/`, `app/`, `lib/`, `cmd/`, etc.) and infer conventional layers.
     - **Tool versions**: `node --version`, `dotnet --version`, `python --version`, `go version` (if installed).
     - **Build/test commands**: Check `package.json` `scripts` (`build`, `test`, `lint`, `dev`), `Makefile` targets, existing CI configs (`.github/workflows/`, `.gitlab-ci.yml`).
   - Generate `STACK.md` from the detected information using the template structure at [`stack.md`](stack.md) as format reference.
   - Write `STACK.md` to the root of the repository.
   - If auto-detection is incomplete or ambiguous (multiple possible stacks), present findings to the user and ask for clarification on uncertain items.
   - Log: `STACK.md created → {path}` in step output.
2. **Parse flags**: `auto`, `dry-run`, `skip-integration`, `skip-tests`, `full`, `--model {name}`, `--model-chain {step:model,...}`.
   - `--model {name}` → `currentModel = {name}`
   - `--model-chain` → parse pairs; store in `state.modelChain`. At each transition, check `modelChain[N]`; if present, auto-set `currentModel`. Log `model-chain | step {N} | {old} → {new} | ISO`.
   - `--model-chain` takes precedence over `--model` at matching steps. Works in **auto mode** (only way to switch models without pausing).
3. **Log parsed args and switch states**: Write a banner to step output showing all switches and their resolved values:
   ```markdown
   ### Init — Parsed args
   Raw invocation: `{raw args from user}`
   
   | Switch | Resolved |
   |--------|----------|
   | `autoMode` | `{true/false}` |
   | `dryRun` | `{true/false}` |
   | `fullMode` | `{true/false}` |
   | `skipIntegration` | `{true/false}` |
   | `skipTests` | `{true/false}` |
   | `currentModel` | `{model name}` |
   | `modelChain` | `{pairs or empty}` |
   | `slug` | `{slug}` |
   | `workflowId` | `{workflow-id}` |
   | `branch` | `{branch}` |
   | `baseBranch` | `{baseBranch}` |
   ```
   Write this block immediately after flag parsing, before auto-resume. Applies in all modes (normal, auto, dry-run). In `dryRun`, prefix with `[DRY-RUN]`.
4. **Auto resume** or **Active Resume** (see [Resume / reset](#resume--reset)).
5. **Identity**: `workflow-id`, `slug`, `us-dir`.
   - **[spec-to-pr]**: Inject `workflowType: standard` into the initialized frontmatter of `{us-dir}/{workflow-id}.state.md`.
   - **[spec-to-pr-lite]**: Inject `workflowType: lite`.
6. **Baseline**: `git status --porcelain` → `preExistingDirty[]`; `git rev-parse HEAD` → `baselineCommit`.
7. **LOC baseline**: `Shell` capture → `telemetry.loc.baseline`. Store ISO → `telemetry.workflowStartedAt`.
8. **Checkpoint**: tag `uswf/{workflow-id}/before-step-0`.
9. **Progress Board** render.
10. **Step Entry Gate** → dispatch.

---

## Resume / Reset

**Auto:** skip Active Resume; use auto resume policy. If existing `active`/`paused` workflow matches same US/slug + `autoMode` + matching `workflowType`, auto-resume.

**Normal — workflow discovery (mandatory before any new workflow):**

1. `Glob` `{config.plans.dir}/**/*.state.md` (default `.cursor/plans/**/*.state.md`) → list all state files.
2. For each, `Read` frontmatter YAML: `status`, `workflowId`, `slug`, `us`, `currentStep`, `startedAt`, `autoMode`, `workflowType`.
3. **[spec-to-pr]** Filter: (`status: active` or `status: paused`) and `workflowType` is `standard` or absent.
   **[spec-to-pr-lite]** Filter: (`status: active` or `status: paused`) and `workflowType` is exactly `lite`.
4. Present as **selectable list** via AskQuestion:

```text
Found {N} unfinished workflow(s):

1. US {us} — {slug} — Step {currentStep} — started {startedAt} — [{autoMode ? 'AUTO' : 'normal'}] (Recommended)
2. US {us} — {slug} — Step {currentStep} — started {startedAt} — [{autoMode ? 'AUTO' : 'normal'}]

Options:
- Resume workflow #1 (Recommended)
- Resume workflow #2
- Start new workflow (ignore existing)
- Cancel for now
```

5. Resume: load state, `status: active`, skip bootstrap, jump to `currentStep` gate.
6. Paused: resume at same step (checkpoint revert M=currentStep → hygiene → board → gate).
7. No unfinished workflows: skip list, proceed to bootstrap.

**Full reset:** Checkpoint Revert M=1 → gate **Start again** (new workflow-id) / **Exit**.

**Stale state cleanup** (new workflow start or explicit):
- Starting new while old exist → offer: **Archive old workflows** (move to `{workflow-id}.archive/`) / **Delete** / **Keep both**.
- Stale = `status: active|paused` and `startedAt` older than 7 days → flag `[STALE]`.
