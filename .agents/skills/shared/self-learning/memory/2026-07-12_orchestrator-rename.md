### [2026-07-12] Orchestrator rename `us-workflow` → `spec-to-pr`
- **Layer**: Core
- **Module**: Audit
- **Severity**: High
- **Trap Avoided**: Leaving consumer installs on the old folder name `us-workflow` after upstream rename — `update` matches by identical folder name, so orchestrator would stop receiving updates.
- **Solution**: CLI `SKILL_RENAMES` migrates `us-workflow` → `spec-to-pr` and preserves `config.json`. Keep legacy invoke aliases and runtime tokens `uswf/` / `us-{id}` — do not rename those.
