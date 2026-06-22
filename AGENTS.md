# Cursor Reviewer — Instruções para Agentes

Este arquivo traz orientações específicas para agentes e desenvolvedores que operam neste projeto.

## Propósito

O `cursor-reviewer` é uma ferramenta agêntica de Code Review automatizado integrada ao Azure DevOps via `@cursor/sdk`. Ele é executado em modo **somente leitura** (review-only) e gera comentários/threads estruturados na PR sem modificar o repositório sob análise. O read-only é reforçado tecnicamente pelo **sandbox do SDK** (`local.sandboxOptions.enabled`, em `src/agent/stream.ts`), além do contrato no `SYSTEM_PROMPT.md`.

A análise do agente é feita em **duas fases**: (1) triagem conservadora a partir das linhas alteradas e (2) investigação analítica com tools + veredito JSON. O contrato de saída é um único bloco ` ```json ` (`reviews`, `resolvedThreads`, `reviewSummary`) definido em `skills/SYSTEM_PROMPT.md`. Critérios técnicos vêm do harness do projeto alvo (`.agents/skills/`, `.cursor/rules/`) — `skills/CODE_REVIEW.md` roteia o agente para consultá-los via tools.

### Contrato de publicação (gate programático)

Reviews só são publicados na PR quando passam em `src/ado/review-validation.ts`:

| Critério | Regra |
|----------|--------|
| `score` | Número finito **6–10** |
| `fileName` + `lineNumber` | Path não vazio; linha inteira **> 0** |
| `comment`, `analysis` | Texto não vazio |
| `suggestedFix` | Opcional (bloco de código por linguagem — ` ```csharp ```/` ```ts ```/` ```diff ``, nunca ` ```suggestion ``) |
| `impactPaths` | Array com pelo menos um path |
| `developerAction` | `fix-code` ou `escalate` (não `resolve-comment`) |
| Severidade | `critical`, `warning` ou `suggestion` |

Score ≤ 5 ou campos ausentes → descartado (não vira thread). As correções ficam com o desenvolvedor, que trata as threads diretamente na PR.

---

## Portabilidade

O runner pode atuar em qualquer repositório Git alvo:

- **Raiz do Runner (`runnerRoot`):** O diretório raiz do projeto (contém `package.json` e `src/index.ts`).
- **Raiz do Projeto Alvo (`repoRoot`):** O diretório do repositório Git que o agente irá ler e analisar.
  - **Padrão:** `../../` relativo à raiz do runner (para quando está embutido como `scripts/cursor-reviewer`).
  - **Customizado:** `--repo-root <path>` ou `CURSOR_REVIEWER_REPO_ROOT=<path>`. Quando executado como repositório autônomo, o runner detecta automaticamente a própria raiz.
- **Autoexclusão:** O runner exclui a si mesmo do diff para evitar self-review infinito.

---

## Desenvolvimento e Testes

### Testes Unitários e Typecheck

```bash
npm test
```

Executa typecheck (`tsc --noEmit`) e suites de testes Node.js.

### Validação com Agente (Testes Seed)

```bash
npm run test:seed
```

Instala fixtures, roda reviewer com `--dry-run --seed-test`, valida detecção dos defeitos propositais em `SEED-ISSUES.md`, e limpa o workspace.

### Higiene do workspace

- Artefatos ignorados: `.tmp-*`, `output.seed-test.tmp.txt` (ver `.gitignore`).
- Antes do push: `npm run seed:verify-clean`.

---

## Boas Práticas

- **Mudanças Cirúrgicas:** Mantenha os diffs reduzidos e diretos.
- **Evite Self-Review:** Não desative a exclusão automática do runner, exceto ao desenvolver o próprio runner com `CURSOR_REVIEWER_REVIEW_SELF=true`.
- **Sincronize docs:** Ao alterar `review-validation.ts`, `post-comments.ts`, `git/diff.ts` ou prompts, atualize `README.md`, `AGENTS.md` e `docs/flow-analysis.md` em conjunto.
