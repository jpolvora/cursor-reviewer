# Artifact Registry (canonical)

**Sole source of truth** for workflow artifact names and paths. `SKILL.md`, FAQ, DIAGRAM, and pipeline skills must reference this file; do not invent alternate names.

## Path resolution

| Token | Resolution |
|-------|------------|
| `{plans-dir}` | `config.json.plans.dir` (default: `.cursor/plans`) |
| `{specs-dir}` | `config.json.plans.specsDir` (default: `specs`) — optional mirror only |
| `{us-dir}` | `{plans-dir}/{slug}/` |
| `{slug}` | `us-{id}` for issues; basename or frontmatter `slug:` for local specs |
| `{workflow-id}` | Unique run id (ISO-based); state file basename without `.state.md` |
| `{worktrees-dir}` | `config.json.plans.worktreesDir` with `{slug}` substituted (default: `{us-dir}/worktrees`) |

Never write workflow state under `.agents/`.

## Canonical artifacts (under `{us-dir}`)

| Artifact | Filename | Produced by | Committable |
|----------|----------|-------------|-------------|
| State | `{workflow-id}.state.md` | Orchestrator | No |
| Issue snapshot | `step-00-{slug}.issue.json` | Step 0 / issue fetch | No |
| **Spec (canonical)** | `step-00-{slug}.spec.md` | Step 0 / issue→spec / local register | No |
| Plan | `step-01-{slug}.plan.md` | Step 1 | **Yes (Step 12)** if no refined plan |
| Refined plan | `step-02-{slug}.plan.refined.md` | Step 2 | **Yes (Step 12)** if present (replaces plan) |
| Exec plan | `step-03-{slug}.plan.exec.md` | Step 3 | No |
| DAG | `step-03-{slug}.exec.dag.json` | Step 3 | No |
| Verification report | `step-06-{slug}.plan.report.md` | Step 6 | No |
| Review / fix report | `step-10-{slug}.report.md` | Step 10 | No |
| Integration plan | `step-11-{slug}.integration-test.plan.md` | Step 11 | No |
| Integration report | `step-11-{slug}.integration-test.report.md` | Step 11 | No |
| Delivery result | `step-12-{slug}.result.md` | Step 12 | **Yes (Step 12)** |

## Step 12 delivery commit

Stage **only**:

1. `step-02-{slug}.plan.refined.md` if it exists, else `step-01-{slug}.plan.md`
2. `step-12-{slug}.result.md`

## Spec entry rules

| Input | Action | Canonical write | `source` frontmatter |
|-------|--------|-----------------|----------------------|
| GitHub `{n}` / `US {n}` | `gh issue view` → `github-issue-to-spec.py` | `{us-dir}/step-00-{slug}.spec.md` | `github` |
| ADO `{org}/{project}#{id}` or `ADO {id}` / `WI {id}` | `ado-workitem-to-spec.py` (live or offline JSON) | `{us-dir}/step-00-{slug}.spec.md` | `azure-devops` |
| Hand-written `*.spec.md` (any path) | Copy/normalize into us-dir; ensure `source: local` | `{us-dir}/step-00-{slug}.spec.md` | `local` |
| Free-text brainstorm | `00-write-spec` | `{us-dir}/step-00-{slug}.spec.md` | `local` |

Optional: copy a read-only mirror to `{specs-dir}/{slug}.spec.md` for human browsing. Downstream skills **always** read `## Artifacts.specPath` (must point at the `step-00-` file under `{us-dir}`).

**Snapshot (audit-only):** tracker fetches also write `step-00-{slug}.issue.json` (GitHub issue JSON or ADO WIT JSON). Never treat the snapshot as the canonical spec.

## Forbidden aliases

Do **not** use these as canonical paths (legacy FAQ drift):

- `{us-dir}/{slug}.spec.md`
- `{us-dir}/{slug}.plan.md`
- `{specs-dir}/{slug}.spec.md` as the only copy (mirror OK)
- Bare `{slug}.result.md` without `step-12-` prefix

## Runtime (portability)

| Path | Purpose |
|------|---------|
| `{us-dir}/.runtime/` | Sentinels, PIDs, temp wake signals (not `/tmp`) |
| `{worktrees-dir}/step-{N}/` | Code step isolation |
| `{us-dir}/{workflow-id}.archive/` | Archived stale workflows |
| `{us-dir}/{workflow-id}.baseline/` | Baseline snapshots |

## Skill → step ownership

| Step | Skill |
|------|-------|
| 0 | `00-write-spec` (brainstorm only) |
| 1 | `01-write-plan` |
| 2 | `02-interview` |
| 3 | `03-plan-to-tasks` |
| 5, 10 | `04-implement-tasks` (build / fix) |
| 6 | `05-verify-plan` |
| 9 | `06-code-review` |
| 11 | `07-integration-validation` |
| 13 | `11-ship-pr` (+ `08-fix-pr`, `09-goal-fix-pr`) |
