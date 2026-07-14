### [2026-07-12] validate_state REPO_ROOT depth
- **Layer**: Core
- **Module**: Audit
- **Severity**: Medium
- **Trap Avoided**: `Path(__file__).resolve().parents[3]` from `spec-to-pr/scripts/` points at `.agents`, not the repo root — plans/artifacts resolve under the wrong tree.
- **Solution**: Use `parents[4]` (`scripts` → `spec-to-pr` → `skills` → `.agents` → repo root).
