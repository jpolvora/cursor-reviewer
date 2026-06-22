# Cursor Reviewer — Code Review Agêntico (Review-Only)

Revisor automatizado de Pull Requests para **Azure DevOps**, usando o [**Cursor SDK**](https://cursor.com/docs/sdk/typescript) (`@cursor/sdk`) em modo agêntico. Executa análise profunda com o harness do repositório (`AGENTS.md`, `.cursor/rules/`, skill `code-review`) e publica threads acionáveis na PR. **Não corrige código** — o desenvolvedor trata as issues diretamente nas threads da PR.

**Pipeline (exemplo):** [`azure-pipelines-cursor-code-review.yml`](../../azure-pipelines-cursor-code-review.yml)

---

## Documentação complementar (`docs/`)

Além deste README, a subpasta [`docs/`](docs/) concentra a referência de fluxo:

| Documento | Descrição |
|-----------|-----------|
| [`docs/flow-analysis.md`](docs/flow-analysis.md) | **Referência única** — fluxo completo de análise e decisão (contexto, fases do agente, gate, work items, o que vira thread real) |
| [`docs/two-phase-execution-model.md`](docs/two-phase-execution-model.md) | Modelo de execução — por que as duas fases rodam numa chamada única ao agente e quando multi-agente faria sentido |

---

## Portabilidade e Customização de Prompts

O subprojeto `cursor-reviewer` é **completamente autocontido** e não acessa arquivos externos de skills fora do seu próprio subdiretório.

O runner pode ser executado a partir de sua própria raiz e configurado para atuar em qualquer repositório Git alvo usando o parâmetro `--repo-root <caminho>` ou a variável de ambiente `CURSOR_REVIEWER_REPO_ROOT`. Por padrão, se não forem configurados, o runner assume o caminho `../../` relativo à sua própria pasta (ou seja, assume que reside em `scripts/cursor-reviewer` sob a raiz do projeto principal). O runner valida que o diretório resolvido contém uma pasta `.git` válida e falha imediatamente (exit 1) caso os pré-requisitos abaixo não sejam atendidos.

| Arquivo local de Prompt / Skill | Editável / Customizável | Descrição |
|---------------------------------|-------------------------|-----------|
| `skills/SYSTEM_PROMPT.md` | **Sim** | Contrato portável: modo read-only, processo em duas fases e schema JSON de saída. |
| `skills/CODE_REVIEW.md` | **Sim** | Instruções para consultar o harness do projeto (`AGENTS.md`, `.cursor/rules/`, `.agents/skills/`). |

Edite `SYSTEM_PROMPT.md` para ajustar o contrato da pipeline. Critérios técnicos e checklist ficam nas skills do repositório alvo (`.agents/skills/code-review/`, etc.) — o runner carrega `CODE_REVIEW.md` em runtime para orientar o agente a usá-las via tools.

**Fail-fast:** erros de validação, configuração ou execução encerram com exit code 1. Issues de review **não** contam como falha.

---

## O que faz

1. **Prepara o workspace git** — diff `target...HEAD` (modo local ou CI)
2. **Filtra arquivos elegíveis** — `.cs`, `.ts`, `.html` (exclui proxies, bin/obj, `.md`, etc.)
3. **Coleta contexto ADO** — work items vinculados + threads existentes do bot
4. **Agente Cursor SDK** — análise em **duas fases** (triagem conservadora → investigação analítica + veredito JSON)
5. **Publica uma thread por issue real** — score, urgência, análise, caminhos impactados e correção sugerida
6. **Resolve threads antigas** — somente quando o agente confirma em `resolvedThreads` (por `threadId` ou `fileName`+`lineNumber`)
7. **Publica resumo positivo** — thread fechada com `reviewSummary` quando a PR está limpa (sem issues novas nem pendentes)
8. **Resume o review** — reporta issues na PR; **não bloqueia** a pipeline (exit 0 mesmo com threads abertas)

## O que não faz

- Auto-fix, commit ou push na branch da PR
- Resolução automática só porque a linha sumiu do diff
- Publicação de nits (score ≤ 2), sugestões estéticas ou alertas sem impacto material
- Bloqueio da pipeline por issues de review (exit 0 mesmo com threads abertas)
- Bloqueio por threads de humanos ou de outros bots

---

## Stack

| Componente | Função |
|------------|--------|
| Node.js 22.13+ | Runtime exigido pelo `@cursor/sdk` |
| `@cursor/sdk` | Agente local (`Agent.create` + stream) com `settingSources: ['project']` |
| TypeScript + tsx | Código-fonte e entrypoint |
| `tsx --env-file` | Carregamento automático de variáveis do `.env` |

> **Nota:** o `@cursor/sdk` **não** exige instalar o [Cursor CLI](https://cursor.com/docs/cli/installation). O CLI (`agent`) é alternativa para CI via shell; esta pipeline usa apenas o SDK TypeScript.

---

## Fluxo

```
PR → pipeline → cursor-reviewer
                  ├─ git: diff target...HEAD (local ou CI)
                  ├─ filtro include/exclude
                  ├─ ADO: work items + threads existentes
                  ├─ Agent: análise 2 fases (skills + harness)
                  ├─ parse JSON (reviews + resolvedThreads + reviewSummary)
                  ├─ ADO: resolve confirmadas → post threads → post summary (se limpo)
                  └─ resumo review → exit 0 (issues não bloqueiam) | exit 1 (erro)
```

Correções ficam com o desenvolvedor, que trata as threads diretamente na PR.

---

## Modos git (local vs CI)

| Modo | Quando | Comportamento |
|------|--------|---------------|
| **Local** | Branch git atual = `--source-branch` | Usa `HEAD` diretamente; diff `{targetRef}...HEAD` |
| **Local + uncommitted** | `--include-uncommitted` ou `--seed-test` | Acrescenta staged/unstaged/untracked vs `HEAD` ao escopo (fixtures seed temporárias) |
| **CI** | Detached HEAD ou branch diferente | `git fetch origin` das refs source/target; diff `origin/{target}...origin/{source}` |

Se a ref target não existir localmente, o script faz fetch mínimo de `origin/{target}` (`--depth=1`).

---

## Arquivos elegíveis

Filtros em `config.ts`, configuráveis parcialmente via env:

| Tipo | Padrões |
|------|---------|
| **Include** | `**/*.cs`, `**/*.ts`, `**/*.html`, `*.cs`, `*.ts`, `*.html` |
| **Exclude (base)** | `*/proxy/*`, `*/bin/*`, `*/obj/*`, `*.md`, `*.csproj`, `secret.txt` |
| **Exclude (self-review)** | O próprio diretório do runner (calculado dinamicamente em relação a `repoRoot`) — **ativo por padrão** para evitar loops de self-review. Se o runner estiver fora do `repoRoot`, utiliza por segurança o padrão de fallback `scripts/cursor-reviewer/**`. |

| Variável | Default | Descrição |
|----------|---------|-----------|
| `CURSOR_REVIEWER_REVIEW_SELF` | `false` | `true` inclui `scripts/cursor-reviewer/**` no review (só para desenvolver o runner) |
| `CURSOR_REVIEWER_EXTRA_EXCLUDE_PATTERNS` | — | Globs extras separados por vírgula (ex.: `scripts/foo/**,**/generated/**`) |

Diff considera apenas arquivos **adicionados, modificados ou renomeados** (`--diff-filter=AMR`). Com `--include-uncommitted`, também entram arquivos **não commitados** no working tree (útil para `npm run test:seed` sem commits artificiais).

---

## Resumo do review (não bloqueia a pipeline)

O runner **publica threads** na PR quando encontra issues, mas **não reprova a build** por isso. A pipeline conclui com **exit 0** mesmo que existam threads novas ou pendentes do bot `[Cursor Reviewer]`. O desenvolvedor trata as threads diretamente na PR.

Threads de humanos ou de outros bots **não** entram no resumo de pendentes do bot.

**Visibilidade na build (Azure DevOps):** ao detectar `TF_BUILD=true`, o runner emite logging commands — `##vso[task.logissue]` por achado (aba **Issues**) e `##vso[task.uploadsummary]` com um resumo markdown anexado à build. Não altera o exit code (issues seguem sem bloquear). Fora da pipeline é no-op.

**Diff vazio + contexto ADO válido:** o agente é omitido; o resumo ainda lista threads pendentes do bot (sem falhar a pipeline).

**Dry-run:** simula publicação/resolução sem POST real; exit 0 salvo erro de execução.

### Dedup e resolução

- **Dedup de publicação:** chave `arquivoNormalizado|line:N` — não reposta na mesma linha
- **Resolução:** match por `threadId` ou `fileName`+`lineNumber` em `resolvedThreads`; reply com marcador `<!-- resolution-reply -->` + status `fixed`
- **Resumo positivo:** marcador `<!-- review-summary -->`; thread geral fechada; dedup por conteúdo idêntico

### Política reviews vs reviewSummary

| Condição | Comportamento |
|----------|---------------|
| `reviews` com itens críticos | `reviewSummary` ignorado |
| `reviews` + `reviewSummary` juntos | Mantém reviews; limpa summary |
| Sem reviews, sem críticos, sem threads pendentes | Publica `reviewSummary` (thread fechada) |

### Códigos de saída

| Exit code | Significado |
|-----------|-------------|
| 0 | Execução concluída (com ou sem issues de review publicadas/pendentes). |
| 1 | Erro fatal: parâmetros inválidos, configuração ausente, falha ADO/agente ou exceção não tratada. |

---

## Configuração

### `.env`

```bash
cd scripts/cursor-reviewer
cp .env.example .env
```

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `CURSOR_API_KEY` | Sim | API key do Cursor (Dashboard → Integrations ou Service Account) |
| `AZURE_DEVOPS_EXT_PAT` | Não* | PAT com Code (Read & Write) + Work Items (Read) — *obrigatório para dry-run com contexto ADO ou publicação local |
| `CURSOR_REVIEWER_MODEL` | Não | Modelo do agente (default: `composer-2.5`) |
| `CURSOR_REVIEWER_TARGET_BRANCH` | Não | Branch de comparação do diff (default: `refs/heads/master`) |
| `CURSOR_REVIEWER_BOT_TAG` | Não | Tag do bot na PR (default: `[Cursor Reviewer]`) |
| `CURSOR_REVIEWER_VERBOSE` | Não | Logs verbosos (default: `true`) |
| `CURSOR_REVIEWER_TIMEOUT_MS` | Não | Timeout do agente em ms (default: `600000` — 10 min); ao estourar, o run é **cancelado** via `run.cancel()` |
| `CURSOR_REVIEWER_SANDBOX` | Não | Sandbox read-only do SDK (default: `true`); `false` desativa só para depuração local. Em ambientes sem suporte a sandbox (ex.: agentes de CI), o runner cai automaticamente para execução sem sandbox |
| `CURSOR_REVIEWER_DRY_RUN` | Não | Dry-run via env (default: `false`; prefira `--dry-run`; exit 0 salvo erro) |
| `CURSOR_REVIEWER_ADO_ORG` | Não | Org ADO (local; pipeline infere de `SYSTEM_COLLECTIONURI`) |
| `CURSOR_REVIEWER_ADO_PROJECT` | Não | Projeto ADO |
| `CURSOR_REVIEWER_ADO_REPO` | Não | Repositório ADO |
| `CURSOR_REVIEWER_PR_ID` | Não | ID da PR |
| `CURSOR_REVIEWER_REPO_ROOT` | Não | Caminho para a raiz do repositório/projeto a ser analisado (default: `../../` relativo à raiz do runner). O runner valida que o caminho contém um diretório Git válido (com pasta `.git`). |

O carregamento do `.env` é feito via `tsx --env-file-if-exists=.env` nos scripts npm.

### Alterar o modelo LLM do agente

O modelo é passado ao Cursor SDK como `model: { id: ... }` em `src/agent/stream.ts`. A resolução segue esta ordem de prioridade:

1. **CLI** — `--model <id>` (sobrescreve tudo)
2. **Variável de ambiente** — `CURSOR_REVIEWER_MODEL`
3. **Default** — `composer-2.5` (ID canônico do SDK; não use aliases legados como `composer`, `composer-latest` ou `composer-2`)

**Local (`.env`):**

```bash
# scripts/cursor-reviewer/.env
CURSOR_REVIEWER_MODEL=composer-2.5
```

**Local (flag pontual):**

```bash
npm run review -- --dry-run --model claude-4.6-sonnet-medium-thinking
```

**Azure Pipelines (variable group ou variáveis da pipeline):**

1. Em **Pipelines → Library** (variable group, ex.: `vg-cursor-reviewer`), adicione a variável `CURSOR_REVIEWER_MODEL` com o ID do modelo desejado.
2. O step `Run Cursor Reviewer Agent` já repassa `CURSOR_REVIEWER_MODEL: $(CURSOR_REVIEWER_MODEL)` para o runner.
3. Se a variável não existir no ADO, o runner usa o default `composer-2.5`.

IDs comuns (consulte `Cursor.models.list()`): `composer-2.5` (default, canônico), `composer-2.5-fast`, `claude-4.6-sonnet-medium-thinking`, `gpt-5.4-medium`. Aliases `composer` / `composer-2` redirecionam internamente — prefira o ID canônico.

---

## Azure Pipelines — configuração e publicação

O subprojeto inclui um **template de pipeline pronto para uso**: [`azure-pipelines-cursor-code-review.yml`](azure-pipelines-cursor-code-review.yml). Copie-o para a **raiz do seu repositório** e ajuste as duas variáveis marcadas com `← CONFIGURE`.

### Quick Start

```bash
# 1. Copie o template para a raiz do repo
cp scripts/cursor-reviewer/azure-pipelines-cursor-code-review.yml ./

# 2. Edite as variáveis CONFIGURE no YAML:
#    - group: vg-seu-projeto-ai        ← nome do seu variable group
#    - REVIEWER_DIR: scripts/cursor-reviewer  ← path do subprojeto (ajuste se diferente)
```

### Arquitetura na pipeline

```
PR → azure-pipelines-cursor-code-review.yml
       ├─ checkout: self (fetchDepth: 0, persistCredentials: true)
       ├─ NodeTool@0 (22.13.x)
       ├─ Cache npm
       ├─ npm ci
       └─ npm run review (Cursor SDK)
            ├─ git fetch origin (source + target) em CI
            ├─ ADO: work items + threads existentes (SYSTEM_ACCESSTOKEN)
            ├─ Agent: análise em 2 fases
            └─ resumo → exit 0 | exit 1 (só em erro)
```

### Variáveis do template

| Variável no YAML | Tipo | Descrição |
|-------------------|------|-----------|
| `group: vg-cursor-reviewer` | **Obrigatório** | Nome do variable group (Library) contendo `CURSOR_API_KEY` (secret). |
| `REVIEWER_DIR` | **Obrigatório** | Caminho relativo do subprojeto no repo (default: `scripts/cursor-reviewer`). |
| `CURSOR_REVIEWER_TARGET_BRANCH` | Opcional | Branch de comparação do diff (default: `refs/heads/master`). Defina no variable group ou variáveis do pipeline. |
| `CURSOR_REVIEWER_MODEL` | Opcional | Modelo LLM do agente (default: `composer-2.5`). Defina no variable group ou variáveis do pipeline. |

### Pré-requisitos no Azure DevOps

1. **Variable group** (Pipelines → Library) com secret `CURSOR_API_KEY`.
2. **Build Service** com permissões no repositório:
   - Project Settings → Repositories → *seu repo* → Security
   - `[Nome do Projeto] Build Service (...)` → **Contribute to pull requests** = Allow
   - **View work items in this node** = Allow (Read)
3. **OAuth token na pipeline:** Pipeline → Edit → ⋮ → Settings → **Allow scripts to access the OAuth token**.
4. **Agent pool:** `ubuntu-latest` com Node.js **22.13+** (configurado automaticamente pelo template).

### Registrar a pipeline

1. Azure DevOps: **Pipelines** → **New pipeline** → selecione o repositório.
2. Escolha **Existing Azure Pipelines YAML file**.
3. Caminho: `/azure-pipelines-cursor-code-review.yml` (raiz do repo).
4. Salve (nome sugerido: *Cursor Agent Code Review*).
5. Na primeira execução, autorize o variable group se o ADO solicitar.

> **Importante:** `trigger: none` — a pipeline **não** roda em push; só dispara via **Build Validation** em PR.

### Build Validation (branch policy)

1. **Project Settings** → **Repositories** → branch protegida (ex.: `master`) → **Branch policies**.
2. **+ Add build policy** → **Build validation**.
3. **Build pipeline:** selecione a pipeline criada acima.
4. **Trigger:** *Automatic* (when pull request is created or updated).
5. **Policy requirement:** *Optional* ou *Required* — a pipeline **não falha** por issues de review (exit 0); use *Required* se quiser garantir que o review **execute** em toda PR.

### Variáveis ADO detectadas automaticamente

O runner detecta estas variáveis de pipeline sem configuração adicional:

| Variável | Uso |
|----------|-----|
| `SYSTEM_PULLREQUEST_SOURCEBRANCH` | Branch source da PR |
| `SYSTEM_PULLREQUEST_TARGETBRANCH` | Branch target (fallback) |
| `SYSTEM_PULLREQUEST_PULLREQUESTID` | ID da PR |
| `SYSTEM_COLLECTIONURI` | URI da org ADO (org extraída automaticamente) |
| `SYSTEM_TEAMPROJECT` | Projeto |
| `BUILD_REPOSITORY_NAME` | Repositório |
| `SYSTEM_ACCESSTOKEN` | Token OAuth para publicação |

---

## Scripts npm

| Script | Descrição |
|--------|-----------|
| `npm run review` | Executa o reviewer (`tsx --env-file=.env src/index.ts`) |
| `npm run review:local` | Atalho dry-run (`--dry-run`) |
| `npm run typecheck` | `tsc --noEmit` (rodado na pipeline) |
| `npm test` | Typecheck + testes unitários (manifest, diff uncommitted, avaliador) |
| `npm run test:seed` | E2E com agente: install → dry-run (`--include-uncommitted --seed-test`) → avalia → uninstall |
| `npm run seed:install` | Copia fixtures para `src/` e `angular/` |
| `npm run seed:uninstall` | Remove artefatos seed do workspace |
| `npm run seed:verify-clean` | Falha se seeds ainda existirem (CI/pre-push) |
| `npm run build` | Compila para `dist/` |
| `npm start` | `node dist/index.js` (após build) |

Ver **[SEED-ISSUES.md](./SEED-ISSUES.md)** para o caso de teste com 6 erros intencionais.

---

## Como rodar localmente

### Pré-requisitos

- Node.js 22.13+
- `npm install` em `scripts/cursor-reviewer`
- `.env` com `CURSOR_API_KEY` válida

### Dry-run básico (recomendado)

Detecta automaticamente a branch git atual como source e `refs/heads/master` como target:

```bash
cd scripts/cursor-reviewer
npm run review -- --dry-run
```

### Atalhos shell

**Bash** (`run-local.sh`):

```bash
./run-local.sh                          # menu interativo (10 branches mais recentes)
./run-local.sh feat/minha-feature       # source explícita
./run-local.sh feat/x refs/heads/develop  # source + target
```

> **CI / Azure Pipelines:** `run-local.sh` é só para teste local. A pipeline usa `npm run review` com `--source-branch "$(System.PullRequest.SourceBranch)"`. Se `run-local.sh` for invocado em CI sem o 1º argumento, encerra com erro — nunca abre menu interativo.

**PowerShell** (`run-local.ps1`):

```powershell
.\run-local.ps1
.\run-local.ps1 -SourceBranch feat/minha-feature
.\run-local.ps1 -SourceBranch feat/x -TargetBranch refs/heads/develop
```

### Opções CLI avançadas

```bash
# Branch específica
npm run review -- --dry-run --source-branch refs/heads/nome-da-feature

# Target customizado
npm run review -- --dry-run \
  --source-branch refs/heads/feat/x \
  --target-branch refs/heads/develop

# Incluir arquivos não commitados (ex.: fixtures seed temporárias)
npm run review -- --dry-run --include-uncommitted

# Validação seed (include-uncommitted + prompt de teste)
npm run review -- --dry-run --seed-test

# Gate completo com contexto ADO real (work items + threads)
npm run review -- \
  --dry-run \
  --source-branch refs/heads/sua-feature \
  --org sua-org \
  --project SeuProjeto \
  --repo SeuProjeto \
  --pr-id 123
```

Neste modo, configure `AZURE_DEVOPS_EXT_PAT` no `.env`.

### Publicação real (local)

Requer contexto ADO completo **e** token (sem `--dry-run`):

```bash
npm run review -- \
  --source-branch refs/heads/sua-feature \
  --org sua-org \
  --project SeuProjeto \
  --repo SeuProjeto \
  --pr-id 123
```

---

## Branches (source vs target)

| Branch | Origem | Default |
|--------|--------|---------|
| **Source** | Branch da PR (`SYSTEM_PULLREQUEST_SOURCEBRANCH`) ou branch git atual / `--source-branch` | automático |
| **Target** | Branch de comparação do diff | `refs/heads/master` |

Configure a target via `.env`, CLI (`--target-branch`) ou variable group (`CURSOR_REVIEWER_TARGET_BRANCH`).

Refs curtas (`master`, `develop`) são normalizadas para `refs/heads/...`.

---

## Formato das threads

**Issue (thread active):**

```
[Cursor Reviewer]

🛑 **CRITICAL:** Descrição objetiva...

**Correção sugerida:**

```csharp
// patch cirúrgico (fence por linguagem — não ```suggestion)
```

<details>
<summary>🔍 Detalhes da Análise IA</summary>

**Score:** 8/10 | **Ação dev:** fix-code

**Análise:**
Caminho X falha quando Y...

**Caminhos analisados:** /src/Foo.cs, /test/FooTests.cs
</details>
```

**Resumo positivo (thread closed):**

```
[Cursor Reviewer]
<!-- review-summary -->

Revisão concluída sem apontamentos. ...
```

Na **Fase 2** do prompt, o agente deve ler o arquivo inteiro via tools antes de publicar qualquer review.

---

## Resposta JSON do agente

O parser prioriza o último bloco ` ```json ` válido; se não houver fence, varre os objetos `{...}` de nível superior (chaves balanceadas) e usa o último JSON válido com `reviews`. Em seguida normaliza os campos:

```json
{
  "reviews": [
    {
      "fileName": "/src/Exemplo.cs",
      "lineNumber": 42,
      "severity": "critical",
      "comment": "Descrição objetiva",
      "score": 8,
      "developerAction": "fix-code",
      "analysis": "Por que o achado é real...",
      "impactPaths": ["/src/Foo.cs"],
      "suggestedFix": "```csharp\n// patch sugerido\n```"
    }
  ],
  "resolvedThreads": [{ "threadId": 12345, "note": "Validação adicionada em Foo.cs" }],
  "reviewSummary": ""
}
```

Campos `score` (6–10), `developerAction` (`fix-code` ou `escalate`), `analysis` e `impactPaths` são **obrigatórios** em cada review publicável. `suggestedFix` é opcional (bloco de código por linguagem — ` ```csharp `/` ```ts `/` ```diff `; **não** ` ```suggestion `, que o Azure DevOps não aplica). Reviews com score ≤ 5 ou campos obrigatórios ausentes são descartados pelo gate em `src/ado/review-validation.ts`.

---

## Seed issues (teste local)

Fixtures temporárias em disco (`seed:install` → review com `--seed-test` → `seed:uninstall`). Consulte [`SEED-ISSUES.md`](SEED-ISSUES.md) para cenários, execução e checklist de limpeza.

---

## Exemplo de execução (dry-run)

```
Cursor Reviewer
Modo: DRY-RUN
Source: refs/heads/feat/minha-feature → Target: refs/heads/master

━ Preparando repositório local ━
Repositório: /caminho/para/seu-projeto
Branch atual: feat/minha-feature
Local mode: on branch 'feat/minha-feature', using local HEAD directly.
Diff: master...HEAD (abc1234..def5678)
5 arquivo(s) elegível(is) no diff.

━ Processando resposta do agente ━
Reviews: 2
Resolved threads (agent): 0
Has critical: true

━ DRY-RUN — JSON que seria publicado ━
{ ... }

━ Concluído ━
Agent: agent_abc | Run: run_xyz
=== Resumo do Cursor Reviewer ===
Modo: DRY-RUN
Agent ID: agent_abc
Run ID: run_xyz
Reviews novos: 2
Threads resolvidas neste run: 0
Threads pendentes na PR: 0
Severidades (novos): critical=1, warning=1, suggestion=0
Review: COM ISSUES PENDENTES
Motivo: 2 nova(s) thread(s) de review seriam publicadas
Pipeline: SUCESSO (exit 0 — issues de review não bloqueiam a build)
```

---

## Estrutura do projeto

```
scripts/cursor-reviewer/
├── .env                    # Variáveis locais (gitignored)
├── .env.example            # Template do .env
├── package.json            # Scripts npm
├── tsconfig.json
├── docs/                   # Documentação complementar (fluxo)
│   └── flow-analysis.md    # Fluxo de análise e decisão (referência única)
├── skills/                 # Prompts customizáveis carregados em runtime
│   ├── SYSTEM_PROMPT.md    # Contrato portável (read-only + JSON)
│   └── CODE_REVIEW.md      # Roteamento para harness do projeto
├── run-local.ps1           # Atalho PowerShell (dry-run)
├── run-local.sh            # Atalho Bash (dry-run)
├── README.md
└── src/
    ├── index.ts            # Orquestração + gate
    ├── config.ts           # CLI args + env + padrões include/exclude
    ├── project.ts          # Resolução de runnerRoot/repoRoot + layout
    ├── logger.ts           # Logger estruturado
    ├── agent/
    │   ├── runner.ts       # Agent.create + prompt
    │   ├── prompt.ts       # Montagem do prompt (system + harness + contexto pipeline)
    │   ├── model.ts        # Resolução/validação do modelo Cursor
    │   └── stream.ts       # Streaming (assistant, tool_call, thinking) + timeout
    ├── ado/
    │   ├── client.ts       # Cliente REST Azure DevOps (retry 429/5xx + Retry-After)
    │   ├── gate.ts         # Resumo de issues abertas (não altera exit code)
    │   ├── post-comments.ts# Publicação, resolução, reviewSummary
    │   ├── review-validation.ts # Gate programático (score + campos obrigatórios)
    │   ├── review-context.ts# Threads existentes + dedup keys
    │   ├── work-items.ts   # Work items vinculados à PR
    │   ├── format-thread.ts# Formatação do corpo da thread publicada
    │   ├── utils.ts        # normalizeFilePath, commentHasBotTag, stripHtml
    │   └── types.ts        # Tipos ADO e reviews
    ├── git/
    │   ├── diff.ts         # Checkout/fetch, diff, filtros glob
    │   └── markers.ts      # Marcadores HTML (resolution, summary)
    └── parser/
        └── review-response.ts  # Extração (fence/balanced-brace) e sanitização do JSON
```

---

## Parâmetros CLI

| Flag | Descrição |
|------|-----------|
| `--dry-run` | Sem publicação ADO; exit 0 salvo erro de execução |
| `--verbose` / `--quiet` | Controle de logs |
| `--source-branch REF` | Override da branch source |
| `--target-branch REF` | Branch de comparação (default: `refs/heads/master`) |
| `--org`, `--project`, `--repo`, `--pr-id` | Contexto Azure DevOps |
| `--bot-tag TAG` | Tag do bot (default: `[Cursor Reviewer]`) |
| `--model ID` | Modelo Cursor (default: `composer-2.5`) |
| `--repo-root PATH` | Caminho para a raiz do repositório/projeto a ser analisado (default: `../../` relativo à raiz do runner). |
| `--help` / `-h` | Ajuda |

---

## Variáveis de ambiente (pipeline)

| Variável | Origem |
|----------|--------|
| `CURSOR_REVIEWER_MODEL` | Variable group ou variável da pipeline (default no runner: `composer-2.5`) |
| `CURSOR_REVIEWER_TARGET_BRANCH` | Variable group ou variável da pipeline (default no runner: `refs/heads/master`) |
| `SYSTEM_PULLREQUEST_SOURCEBRANCH` | Branch source da PR |
| `SYSTEM_PULLREQUEST_TARGETBRANCH` | Branch target da PR (fallback) |
| `SYSTEM_PULLREQUEST_PULLREQUESTID` | ID da PR |
| `SYSTEM_COLLECTIONURI` | URI da org (org extraída automaticamente) |
| `SYSTEM_TEAMPROJECT` | Projeto |
| `BUILD_REPOSITORY_NAME` | Repositório |
| `SYSTEM_ACCESSTOKEN` | Token OAuth (publicação na pipeline) |

---

## Troubleshooting

### `CURSOR_API_KEY é obrigatório`

1. Confirme que `.env` existe em `scripts/cursor-reviewer/`
2. Verifique se a chave está preenchida
3. Use `npm run review` (carrega `--env-file=.env` automaticamente)

### `Contexto ADO incompleto`

Fora da pipeline, use `--dry-run` ou passe `--org`, `--project`, `--repo`, `--pr-id`.

### `Token ADO ausente`

Pipeline: habilite **Allow scripts to access the OAuth token**. Local: defina `AZURE_DEVOPS_EXT_PAT`.

### Nenhum arquivo elegível para revisão

O diff não contém `.cs`, `.ts` ou `.html` revisáveis, ou todos foram excluídos (proxies, bin/obj, `.md`, `.csproj`, `secret.txt`).

### `Git error: fatal: ...`

Atualize refs remotas: `git fetch origin master` (ou a target configurada).

### JSON inválido na resposta do agente

O parser tenta sanitizar aspas e quebras de linha. Se persistir, rode com `--verbose` e inspecione a saída bruta do agente.

---

## Referências

| Recurso | Caminho |
|---------|---------|
| Fluxo de análise e decisão | `scripts/cursor-reviewer/docs/flow-analysis.md` |
| Instruções de harness (runner) | `scripts/cursor-reviewer/skills/CODE_REVIEW.md` |
| System Prompt / contrato JSON | `scripts/cursor-reviewer/skills/SYSTEM_PROMPT.md` |
| Skill code-review (projeto) | `.agents/skills/code-review/SKILL.md` |
| Contrato ADO (referência) | `scripts/code-review/README.md` |
| Prompt JSON legado (PowerShell) | `scripts/code-review/prompts/exemplo.codereviewprompt.md` |
| Pipeline YAML | `azure-pipelines-cursor-code-review.yml` |
| Cursor SDK Docs | https://cursor.com/docs/sdk/typescript |
