# Cursor Reviewer — Instruções para Agentes

Este arquivo traz orientações específicas para agentes e desenvolvedores que operam dentro do subprojeto `scripts/cursor-reviewer/`.

## Propósito do Subprojeto

O `cursor-reviewer` é uma ferramenta agêntica de Code Review automatizado integrada ao Azure DevOps via `@cursor/sdk`. Ele é executado em modo **somente leitura** (review-only) e gera comentários/threads estruturados na PR sem modificar o repositório sob análise. O read-only é reforçado tecnicamente pelo **sandbox do SDK** (`local.sandboxOptions.enabled`, em `src/agent/stream.ts`), além do contrato no `SYSTEM_PROMPT.md`.

A análise do agente é feita em **duas fases**: (1) triagem conservadora a partir das linhas alteradas e (2) investigação analítica com tools + veredito JSON. O contrato de saída é um único bloco ` ```json ` (`reviews`, `resolvedThreads`, `reviewSummary`) definido em `skills/SYSTEM_PROMPT.md`. Critérios técnicos vêm do harness do projeto (`.agents/skills/`, `.cursor/rules/`) — `skills/CODE_REVIEW.md` roteia o agente para consultá-los via tools. O fluxo completo está documentado em [`docs/flow-analysis.md`](docs/flow-analysis.md); o racional de **chamada única vs. multi-agente** em [`docs/two-phase-execution-model.md`](docs/two-phase-execution-model.md) — mantenha-os sincronizados ao alterar o pipeline, o parser ou os prompts.

### Contrato de publicação (gate programático)

Reviews só são publicados na PR quando passam em `src/ado/review-validation.ts`:

| Critério | Regra |
|----------|--------|
| `score` | Número finito **6–10** |
| `fileName` + `lineNumber` | Path não vazio; linha inteira **> 0** |
| `comment`, `analysis` | Texto não vazio |
| `suggestedFix` | Opcional (bloco de código por linguagem — ` ```csharp `/` ```ts `/` ```diff `, nunca ` ```suggestion `) |
| `impactPaths` | Array com pelo menos um path |
| `developerAction` | `fix-code` ou `escalate` (não `resolve-comment`) |
| Severidade | `critical`, `warning` ou `suggestion` |

Score ≤ 5 ou campos ausentes → descartado (não vira thread). As correções ficam com o desenvolvedor, que trata as threads diretamente na PR.

---

## Configuração de Caminhos e Portabilidade

O subprojeto é projetado para rodar de forma autocontida a partir de sua própria raiz:

- **Raiz do Runner (`runnerRoot`):** Localizada dinamicamente a partir do arquivo executado (normalmente `scripts/cursor-reviewer`).
- **Raiz do Projeto Alvo (`repoRoot`):** O diretório do repositório Git que o agente irá ler e analisar.
  - **Padrão (Default):** `../../` relativo à raiz do runner (ou seja, assume que o runner está sob `scripts/cursor-reviewer` e analisa o repositório principal).
  - **Customizado:** Pode ser configurado passando o parâmetro CLI `--repo-root <path>` ou definindo a variável de ambiente `CURSOR_REVIEWER_REPO_ROOT=<path>`.
- **Autoexclusão do Runner:** O runner calcula o caminho relativo de `runnerRoot` em relação a `repoRoot`. Se ele estiver inserido no projeto analisado, a sua própria pasta é adicionada dinamicamente aos padrões de exclusão (`excludePatterns`) para evitar self-review infinito.

---

## Estrutura de Desenvolvimento e Testes

Ao dar manutenção neste projeto, utilize as seguintes ferramentas para validação local de suas alterações:

### 1. Testes Unitários e Typecheck
Rode os testes rápidos do runner (valida parse do JSON, montagem de prompts, filtros de diff, gate de publicação, etc.):
```bash
npm test
```
Este script executa o typecheck (`tsc --noEmit`) e em seguida roda as suites de testes do Node.js.

### 2. Validação Fim-a-fim com Agente (Testes Seed)
O projeto possui um cenário de teste real onde o agente roda localmente contra defeitos propositais (seeds) instalados em arquivos temporários:
```bash
npm run test:seed
```
Este comando executa a seguinte sequência:
- Instala os arquivos seed na árvore de arquivos (`seed:install`).
- Roda o reviewer localmente com o agente real usando `--dry-run --seed-test` (comparando uncommitted contra HEAD).
- O agente deve encontrar os defeitos propositais descritos em `SEED-ISSUES.md`.
- Desinstala os arquivos seed (`seed:uninstall`) e valida que o workspace está limpo (`seed:verify-clean`).

### 3. Higiene do workspace
- Repositórios git temporários dos testes ficam em `os.tmpdir()` (não dentro do pacote).
- Artefatos ignorados: `.tmp-*`, `output.seed-test.tmp.txt` (ver `.gitignore`).
- Antes do push: `npm run seed:verify-clean`.

---

## Boas Práticas e Guardrails

- **Mudanças Cirúrgicas:** Mantenha os diffs o mais reduzidos e diretos possível.
- **Evite Self-Review:** Nunca desative a lógica de exclusão automática do runner, exceto se estiver desenvolvendo funcionalidades diretamente ligadas ao próprio runner e a variável `CURSOR_REVIEWER_REVIEW_SELF` estiver ativada.
- **Portabilidade:** Evite assumir caminhos fixos absolutos ou relativos rígidos que quebrem caso o subprojeto seja movido para outro diretório ou executado externamente.
- **Sincronize docs:** Ao alterar `review-validation.ts`, `post-comments.ts`, `git/diff.ts` ou prompts, atualize `README.md`, `AGENTS.md` e `docs/flow-analysis.md` em conjunto.
