# Implementation Plan — PR #18 Review Threads

## Thread #1 — `prompt.ts:268` (SCORE_MIN mismatch)

**Root cause:** `SYSTEM_PROMPT.md` hardcodes score tables for default `SCORE_MIN=6`. Only Phase 2.4 injects `config.scoreMin`, so agents miscalibrate when `SCORE_MIN≠6`.

**Fix:**
- Add `buildScoreMinOverrideSection(scoreMin)` injected right after the static system prompt when `scoreMin !== 6`.
- Parameterize `buildSeedTestSection(scoreMin)` instead of hardcoded `score ≥ 5`.

**Tests:** Assert override section appears for `scoreMin=4` and is absent for default `6`.

## Threads #2 & #3 — GitHub reviewSummary sanitization

**Root cause:** `GithubProvider.setPullRequestReviewSummary` calls `sanitizeReviewSummaryForPlatform`, which neutralizes all `#N` as ADO Work Items — breaking valid GitHub issue/PR autolinks.

**Fix:**
- Add `platform: 'ado' | 'github'` to `ReviewSummarySanitizeOptions` (default `'ado'`).
- Early-return trimmed text for `platform === 'github'`.
- Pass `platform: 'github'` from `GithubProvider`.

**Tests:** Assert GitHub platform preserves `#42` and does not rewrite to "Work Item".

## Validation

```bash
npm test
```
