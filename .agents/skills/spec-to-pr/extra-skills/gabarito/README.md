# Gabarito

Operational communication skill for Cursor agents: ten directives plus style discipline.

## What it does

- Runs **every turn** (always-on) unless opted out
- Improves accountability, anti-sycophancy, clarification, verification, and prose quality
- First reply only: short signal line (*"Gabarito em uso."*)

## Matrix repo

Listed in `AGENTS.md` § Skill loading (autoload every prompt). Works alongside `senior-developer`, `karpathy-guidelines`, and **caveman full**; does not replace specs or engineering rules.

## Caveman

**caveman full** autoloaded with Gabarito unless `stop caveman` / `normal mode`. Level switches: `/caveman lite|ultra|…`. See `../caveman/SKILL.md`.

## Opt-out

`stop gabarito`, `sem gabarito`, or `normal mode` (caveman off: `stop caveman`)

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Agent instructions (authoritative) |
| `README.md` | This summary |
