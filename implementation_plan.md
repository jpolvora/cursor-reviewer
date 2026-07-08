# Implementation Plan — PR #18 Review Threads (round 3)

## Threads #1 & #2 — `review-summary.ts:44/52` ($ in prTitle corrupts replace)

**Root cause:** `String.replace` interprets `$1`, `$&`, `$$` in replacement strings. When `prTitle` from the API contains `$` (e.g. monetary values), interpolated replacement strings corrupt the published `reviewSummary`.

**Fix:**
- Use callback replacements in `correctMisplacedWorkItemTitles` so `prTitle` is literal text, not replace metacharacters.

**Tests:**
- ADO: WI title correction and header rewrite with `$` in prTitle
- GitHub: WI title correction with `$` in prTitle

## Validation

```bash
npm test
```
