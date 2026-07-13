---
id: null
slug: cursor-reviewer-docs-website
title: "Cursor Reviewer Documentation and Website"
source: local
specDate: 2026-07-13
---

# Specification — Cursor Reviewer Documentation and Website

## Description

This feature specifies the creation of a static documentation website for the `cursor-reviewer` project, following the visual and structural template of `workflow-skills`. The site will present the product overview, explain how it works, detail local and CI installation steps, list features and requirements, and host an interactive, filterable catalog of all agent skills locally installed under `.agents/skills/`. To keep the website up to date, it specifies a Node.js generation script (`scripts/build-site.js`) and a GitHub Actions workflow to run on every merge/push to `main`.

## Acceptance Criteria

- **AC1: Presentation Site:** Create `docs/index.html` presenting the `cursor-reviewer` product, its features (Two-Phase Review Model, Surgical Threads, Cooperative Loop), requirements (Node.js 22.13+, `CURSOR_API_KEY`), and step-by-step local/CI guides (GitHub Actions, Azure DevOps).
- **AC2: Visual Theme & Styling:** Implement the high-quality dark mode aesthetic using CSS variables, Geist typography, modern grids, layout cards, and a modal view containing Markdown/Raw tabs. Copy and setup `docs/assets/css/style.css` and `docs/.nojekyll`.
- **AC3: Skill Catalog Compiler:** Implement `scripts/build-site.js` to dynamically scan `.agents/skills/*`, read the frontmatter metadata (name, description, version) from each `SKILL.md`, group them into logical categories (spec-to-pr Pipeline, Review & Audit, General/Utility), and compile this catalog directly into `docs/index.html`.
- **AC4: FAQ Documentation:** Update `docs/faq.md` to document the new website and build mechanics, and create `docs/faqs/README.md` in Portuguese to guide users on updating the site.
- **AC5: Deploy-Site Automation:** Configure `.github/workflows/deploy-site.yml` to trigger on pushes to the `main` branch, build/compile the site catalog, and commit/push any regenerated changes back to the repository.

## Notes

- The site uses `marked.js` in client-side JavaScript to render skill descriptions fetched dynamically via the GitHub raw content domain: `https://raw.githubusercontent.com/jpolvora/cursor-reviewer/main/`.
