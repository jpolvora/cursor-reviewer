### [2026-07-12] AskQuestion must be FORCE-invoked at gates
- **Layer**: Core
- **Module**: Auth
- **Severity**: Critical
- **Trap Avoided**: Agents “decide” AskQuestion is unavailable and print markdown menus without calling the tool — gates become free-text and HS-1/cancel semantics break.
- **Solution**: Probe exposure, always invoke `AskQuestion` in normal mode, log `askquestion-exposed` / `askquestion-unavailable`, markdown fallback only after explicit invoke failure. Ship `.cursor/rules/ask-question-gates.mdc` (from `spec-to-pr/cursor-rules/`) for alwaysApply in consumers.
