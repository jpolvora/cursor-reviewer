# Shared — Workflow Skills Shared Resources

> **These skills and config files are shared dependencies consumed by the
> [`spec-to-pr`](../spec-to-pr/SKILL.md) and [`spec-to-pr-lite`](../spec-to-pr-lite/SKILL.md)
> workflow orchestrators.**
>
> Skills in subdirectories here are **managed upstream copies** installed by
> `npx github:jpolvora/workflow-skills`. Do **not** edit them in-place — changes
> will be overwritten on the next `update`. To contribute improvements, open a
> pull request against [`jpolvora/workflow-skills`](https://github.com/jpolvora/workflow-skills).
>
> The sole exception: `config.json` and `self-learning/memory/` are **consumer-owned**
> and are preserved on every update.

---

## Config & Tools

| File | Purpose |
|------|---------|
| `config.json.example` | Project config template — copy to `config.json`, fill in, never commit |
| `config.schema.json` | JSON Schema for `config.json` validation |
| `tools.md` | Canonical agent tool vocabulary (aliases → config keys) |
| `stack.md` | Human-readable companion to `config.json` |
| `setup.md` | Bootstrap & entry logic shared by `spec-to-pr` and `spec-to-pr-lite` |

---

## Shared Skills

All skills below are consumed by **`spec-to-pr`** and/or **`spec-to-pr-lite`**.
They are placed here because they are workflow-agnostic and referenced by other
skills outside those two orchestrators.

| Skill | Path | Consumers | Trigger |
|-------|------|-----------|---------|
| `caveman` | [`caveman/SKILL.md`](caveman/SKILL.md) | `spec-to-pr`, `spec-to-pr-lite`, global autoload | Every prompt — response compression |
| `gabarito` | [`gabarito/SKILL.md`](gabarito/SKILL.md) | `spec-to-pr`, `spec-to-pr-lite`, `check-harness`, global autoload | Every prompt — operational guidelines |
| `karpathy-guidelines` | [`karpathy-guidelines/SKILL.md`](karpathy-guidelines/SKILL.md) | `spec-to-pr`, `spec-to-pr-lite`, `tdd-sdd-ddd-reviewer`, `domain-review`, global autoload | Every prompt — behavioral guardrails |
| `spec-format` | [`spec-format/SKILL.md`](spec-format/SKILL.md) | `spec-to-pr`, `00-write-spec`, `github-provider`, `azure-devops-provider`, `local-spec-provider` | `/spec-format` — create/review/format `*.spec.md` |
| `goal-loop` | [`goal-loop/SKILL.md`](goal-loop/SKILL.md) | `spec-to-pr` → `09-goal-fix-pr` | Convergence loops |
| `self-learning` | [`self-learning/SKILL.md`](self-learning/SKILL.md) | `spec-to-pr`, `spec-to-pr-lite` | Task completion — anti-regression record in `MEMORY.md` |
| `changelog` | [`changelog/SKILL.md`](changelog/SKILL.md) | `spec-to-pr`, `spec-to-pr-lite` | Task completion — historical record in `CHANGELOG.md` |
