---
name: changelog
description: Write a summarized historical record of the task into CHANGELOG.md. Use at the very end of every implementation task.
---

# Changelog

**Mandatory completion gate** — run after [learning](../learning/SKILL.md) at the end of implementation tasks.

## When to run

Run at the end of every implementation task to maintain a historical record of what was actually built, fixed, or modified. 

**Important:** This file is strictly for historical tracking and auditing. It is an append-only file and should NOT be used for reading context or preventing regressions (use `MEMORY.md` for that). Do not re-read or rewrite past entries.

## Process

1. **Analyze context** - What was the prompt? What did the agent (you) actually do? What was the final result?
2. **Update `CHANGELOG.md`** (repo root) - Append a new entry using the template below. Create the file if it doesn't exist.

## CHANGELOG.md Template

Append the following exact format to the bottom of the file:

```markdown
### [YYYY-MM-DD HH:MM] Agent: [Agent Type, e.g., Antigravity]
- **Prompt**: [Brief summarized intent of the user's request]
- **Done**: [What was actually implemented, changed, or fixed]
- **Result**: [Final outcome, status, or any immediate next steps]
```
