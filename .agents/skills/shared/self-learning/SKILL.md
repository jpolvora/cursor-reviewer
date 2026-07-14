---
name: self-learning
description: Analyze session output and record anti-regression knowledge (mistakes, traps, and pitfalls to avoid) into conflict-free memory files, then compile MEMORY.md. Use when completing a task or implementation.
---

# Self-Learning

**Mandatory completion gate** — run after verification and code review proof. Task is **not done** until this skill runs and the proof includes a **`Learning:`** line.

## When to run

| Task type | Action |
|-----------|--------|
| Implementation hit a trap/pitfall/race condition | Create a new file in `memory/` directory, then run `self_learning.py --compile` |
| Standard feature/bug fix without non-obvious traps | Proof line: `Learning: N/A (standard implementation)` |
| Pure Q&A, no code or durable insight | Proof line: `Learning: N/A (no new project knowledge)` |

## Process

1. **Analyze context** — What did we try that failed? What non-obvious constraint or pitfall did we hit?
2. **Write to `memory/`** — Write a new file under `.agents/skills/shared/self-learning/memory/YYYY-MM-DD-[slug].md`. **ONLY** record traps/pitfalls. **DO NOT** use it as a changelog or to record standard patterns that an LLM already knows.
3. **Compile `MEMORY.md`** — Run the compilation command:
   ```bash
   python .agents/skills/shared/self-learning/self_learning.py --compile
   ```
   This will regenerate the `.agents/skills/shared/self-learning/MEMORY.md` file from all files in `memory/` directory.
4. **Proof + chat** — Set `**Learning:** [entry title]` or `N/A` in the final code review proof; provide a one-line summary in the final reply.

## Conflict Resolution

If a merge conflict occurs in `MEMORY.md` when pulling/merging from other branches/developers, **do not resolve it manually**. Run:
```bash
python .agents/skills/shared/self-learning/self_learning.py --compile
```
This will automatically recompile a clean, unified `MEMORY.md` from the individual memory files under `memory/` (which never conflict because they are stored as separate files).

## Individual Memory File Template

Create your entry as a markdown file under `.agents/skills/shared/self-learning/memory/` using the following format:

```markdown
### [YYYY-MM-DD] [Topic/Component]
- **Layer**: [e.g. Core, Infrastructure, Api, Web, Tests, or N/A]
- **Module**: [e.g. Auth, Wallet, Users, or N/A]
- **Severity**: [Low, Medium, High, Critical]
- **Trap Avoided**: [What approach failed, what non-obvious constraint was hit, or what standard LLM assumption was wrong]
- **Solution**: [How to do it correctly to avoid the trap]
```
