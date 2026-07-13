# Plan Implementation Audit Report

Template para o **Modo Quick Score** do `verify-plan`.
Usado quando nao ha spec.md nem numero de US.

- **Target Plan**: [Plan Name/Path]
- **Date/Time**: [Timestamp]
- **Score**: [0-10]/10

## Executive Summary
[Brief description of what was implemented and overall assessment]

## Evaluation Criteria

| Criterion | Score (0-10) | Notes |
| :--- | :--- | :--- |
| **Completeness** (40%) | | [Did it do everything in the plan?] |
| **Correctness & Style** (35%) | | [Any bugs, styling issues, tenancy issues?] |
| **Testing** (25%) | | [Were tests written, ran, and did they pass?] |

## Recommendation
- [ ] **REIMPLEMENT**: Score < 7. Redesign plan or use another model.
- [ ] **APPROVE & COMMIT**: Score >= 7. Proceed to code review and commit.

### Details / Feedback
[Specific files to fix or rewrite, if any]

### Suggested Git Commands
```bash
git add .
git commit -m "feat: [brief description]"
```
