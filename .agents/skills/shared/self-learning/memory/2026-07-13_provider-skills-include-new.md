### [2026-07-13] Provider skills need update --include-new
- **Layer**: Infrastructure
- **Module**: Sponsor
- **Severity**: Medium
- **Trap Avoided**: Assuming plain `npx github:jpolvora/workflow-skills update` installs new top-level skill folders (`github-provider`, `azure-devops-provider`, `local-spec-provider`). CLI only refreshes skills already present locally.
- **Solution**: Consumers must run `update --include-new` (or interactive install) after upstream adds provider skills. Keep AC9 converter shims at `spec-to-pr/scripts/{github-issue,ado-workitem}-to-spec.py` so install canonicity asserts keep passing.
