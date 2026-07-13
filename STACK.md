# Stack Definition — cursor-reviewer

## Project Stack

This project is a Node.js-based code review runner written in TypeScript.

- **Backend:** Node 22 (TypeScript)
  - **Layers:**
    - `src/agent`: Composer API integrations and prompt assembly.
    - `src/ado`: ADO reviews, comments, and validations.
    - `src/git`: Git diff extraction and normalization.
- **Tests:** `test/` (Node.js test runner using `tsx --test`).

## Verification Commands

- **Build:** `npm run build`
- **Test:** `npm test`
- **Lint/Format:** `npx tsc --noEmit`
