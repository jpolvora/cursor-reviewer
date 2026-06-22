# Cursor Reviewer — Code Review Agêntico (Review-Only)

Revisor automatizado de Pull Requests para **Azure DevOps** usando [@cursor/sdk](https://cursor.com/docs/sdk/typescript). Análise profunda com harness do repositório e threads acionáveis na PR. **Não corrige código** — o desenvolvedor trata as issues nas threads.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Quick Start

```bash
npm install
cp .env.example .env   # preencha CURSOR_API_KEY
npm run review -- --dry-run
```

> Documentação completa: [`docs.md`](docs.md)

---

## O que faz

1. Prepara o workspace git — diff `target...HEAD`
2. Filtra arquivos elegíveis (`.cs`, `.ts`, `.html`)
3. Coleta contexto ADO — work items + threads do bot
4. Agente Cursor SDK — análise em 2 fases (triagem → investigação + JSON)
5. Publica uma thread por issue real na PR
6. Resolve threads antigas confirmadas pelo agente
7. Publica resumo positivo quando a PR está limpa

## O que não faz

- Auto-fix, commit ou push
- Publicação de nits (score ≤ 5)
- Bloqueio da pipeline por issues de review (exit 0)

---

## Stack

| Componente | Função |
|------------|--------|
| Node.js 22.13+ | Runtime |
| `@cursor/sdk` | Agente local (`Agent.create` + stream) |
| TypeScript + tsx | Código-fonte |

---

## Scripts npm

| Script | Descrição |
|--------|-----------|
| `npm run review` | Executa o reviewer |
| `npm run review:local` | Dry-run |
| `npm test` | Typecheck + testes unitários |
| `npm run test:seed` | E2E com agente real |
| `npm run build` | Compila para `dist/` |

---

## Estrutura do projeto

```
./
├── docs.md               # Documentação completa
├── docs/                 # Docs complementares (fluxo, FAQ, score)
├── skills/               # Prompts customizáveis
│   ├── SYSTEM_PROMPT.md
│   └── CODE_REVIEW.md
├── src/
│   ├── index.ts          # Orquestração + gate
│   ├── config.ts         # CLI args + env
│   ├── agent/            # Runner, prompt, stream, model
│   ├── ado/              # Cliente ADO, validação, publicação
│   ├── git/              # Diff, filtros, marcadores
│   ├── parser/           # Parse da resposta JSON do agente
│   └── seed/             # Fixtures de teste E2E
├── fixtures/seed/        # Cenários de teste intencionais
├── azure-pipelines-cursor-code-review.yml  # Pipeline template
├── run-local.sh / .ps1   # Atalhos locais
└── AGENTS.md             # Instruções para agentes
```

---

## Documentação

| Recurso | Descrição |
|---------|-----------|
| [`docs/index.md`](docs.md) | Documentação completa (config, ADO, CLI, troubleshooting) |
| [`docs/flow-analysis.md`](docs/flow-analysis.md) | Fluxo de análise e decisão |
| [`docs/faq.md`](docs/faq.md) | FAQ |
| [`docs/score_calc.md`](docs/score_calc.md) | Score 0–10 e severidade |
| [`docs/two-phase-execution-model.md`](docs/two-phase-execution-model.md) | Modelo de execução |
| [`SEED-ISSUES.md`](SEED-ISSUES.md) | Cenários de teste E2E |
| [`AGENTS.md`](AGENTS.md) | Instruções para agentes |
| [`azure-pipelines-cursor-code-review.yml`](azure-pipelines-cursor-code-review.yml) | Pipeline template |
| [Cursor SDK Docs](https://cursor.com/docs/sdk/typescript) | Documentação do SDK |
