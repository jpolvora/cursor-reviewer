---
name: learning
description: Analyze session output and record ONLY anti-regression knowledge (mistakes, traps, and pitfalls to avoid) into MEMORY.md, then print a summary. Use when completing a task or implementation.
---

# Learning

**Mandatory completion gate** — run after verification, code review proof, and [DOCS-SYNC](../../../senior-developer/DOCS-SYNC.md). Task is **not done** until this skill runs and the proof includes a **`Learning:`** line ([senior-developer](../../../senior-developer/SKILL.md) § Code review proof).

## When to run

| Task type | Action |
|-----------|--------|
| Implementation hit a trap/pitfall/race condition | Append new anti-regression entry to `MEMORY.md` |
| Standard feature/bug fix without non-obvious traps | Proof line: `Learning: N/A (standard implementation)` — no `MEMORY.md` edit |
| Pure Q&A, no code or durable insight | Proof line: `Learning: N/A (no new project knowledge)` — no `MEMORY.md` edit |

## Process

1. **Analyze context** — What did we try that failed? What non-obvious constraint or pitfall did we hit?
2. **Update `MEMORY.md`** (root) — **ONLY** append new traps/pitfalls. **DO NOT** use `MEMORY.md` as a changelog or to record standard C#/React patterns that an LLM already knows.
3. **Proof + chat** — set `**Learning:** [entry title]` or `N/A` in code review proof; one-line summary in the final reply.

Read full skill before first run each session ([AGENTS.md](../../../../../AGENTS.md) § Skill loading).

## MEMORY.md Template

Format entries with the date, the task context, and bullet points detailing the trap and the solution:

```markdown
### [YYYY-MM-DD] [Topic/Component]
- **Trap Avoided**: [What approach failed, what non-obvious constraint was hit, or what standard LLM assumption was wrong]
- **Solution**: [How to do it correctly to avoid the trap]
```
