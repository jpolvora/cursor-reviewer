# Cursor Reviewer — Code Review Agêntico (Review-Only)

Revisor automatizado de Pull Requests para **Azure DevOps**, usando o [**Cursor SDK**](https://cursor.com/docs/sdk/typescript) (`@cursor/sdk`) em modo agêntico. Executa análise profunda com o harness do repositório (`AGENTS.md`, `.cursor/rules/`, skill `code-review`) e publica threads acionáveis na PR. **Não corrige código** — o desenvolvedor trata as issues diretamente nas threads da PR.

---

## Documentação complementar (`docs/`)

Além deste README, a subpasta [`docs/`](docs/) concentra a referência de fluxo e classificação:

| Documento | Descrição |
|-----------|-----------|
| [`docs/flow-analysis.md`](docs/flow-analysis.md) | **Referência única** — fluxo completo de análise e decisão (contexto, fases do agente, gate, work items, o que vira thread real) |
| [`docs/faq.md`](docs/faq.md) | **FAQ** — fluxo em ordem de execução, US/Task no prompt, configuração, ADO |
| [`docs/score_calc.md`](docs/score_calc.md) | Score (0–10) e severidade (`critical` / `warning` / `suggestion`) — rubrica de atribuição pelo agente, gate programático e exemplos |
| [`docs/two-phase-execution-model.md`](docs/two-phase-execution-model.md) | Modelo de execução — por que as duas fases rodam numa chamada única ao agente e quando multi-agente faria sentido |

---

## Portabilidade e Customização de Prompts

O `cursor-reviewer` é **completamente autocontido** e não acessa arquivos externos de skills fora do seu próprio diretório.

O runner pode ser executado a partir de sua própria raiz e configurado para atuar em qualquer repositório Git alvo usando o parâmetro `--repo-root <caminho>` ou a variável de ambiente `CURSOR_REVIEWER_REPO_ROOT`. Por padrão, se não forem configurados, o runner assume o caminho `demo-project` relativo à sua própria pasta (útil para testar localmente com um projeto de demonstração). Para revisar outro repositório Git, use `--repo-root <caminho>` ou a variável de ambiente `CURSOR_REVIEWER_REPO_ROOT`. O runner valida que o diretório resolvido contém uma pasta `.git` válida e falha imediatamente (exit 1) caso os pré-requisitos abaixo não sejam atendidos.

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

## Convergência — orçamento de rodadas (anti-loop fix→review)

Para evitar o ciclo infinito `fix-pr ↔ reviewer`, o runner persiste um **contador de rodadas** numa thread geral da PR (marcador `<!-- reviewer-round-state -->`, atualizada via PATCH a cada rodada). Quando a rodada atual excede `CURSOR_REVIEWER_MAX_ROUNDS` (default 5) **e ainda há issues abertas**, entra em **escalonamento**:

- publica apenas achados `critical`;
- **suprime** novos warnings/suggestions (não vira thread);
- registra um aviso de **revisão humana recomendada** na thread de estado.

Isso garante terminação: após o orçamento, a decisão volta para o humano em vez de gerar apontamentos indefinidamente. `0` desabilita o mecanismo. A garantia de *recall* na rodada 1 (achar tudo de uma vez) vem do `SYSTEM_PROMPT.md` + passo 2.5 de generalização por classe no prompt.

---

## Resumo do review (não bloqueia a pipeline)

O runner **publica threads** na PR quando encontra issues, mas **não reprova a build** por isso. A pipeline conclui com **exit 0** mesmo que existam threads novas ou pendentes do bot `[Cursor Reviewer]`. O desenvolvedor trata as threads diretamente na PR.

Threads de humanos ou de outros bots **não** entram no resumo de pendentes do bot.

**Visibilidade na build (Azure DevOps):** ao detectar `TF_BUILD=true`, o runner emite logging commands — `##vso[task.logissue]` por achado (aba **Issues**) e `##vso[task.uploadsummary]` com um resumo markdown anexado à build. Não altera o exit code (issues seguem sem bloquear). Fora da pipeline é no-op.

**Prompt enviado ao agente:** imediatamente antes de `agent.send()`, o runner imprime o prompt completo gerado por `buildAgentPrompt` entre os marcadores `Inicio Prompt:` e `Fim do prompt`. Na **Azure Pipeline** o bloco fica numa seção colapsável (`##[group]` / `##[endgroup]`); no terminal local usa banners e destaque ANSI de cabeçalhos/separadores markdown. Cores: automáticas em TTY/pipeline; `NO_COLOR=1` desliga; `FORCE_COLOR=1` força; `CURSOR_REVIEWER_PROMPT_COLOR=false` desliga só na pipeline.

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
cp .env.example .env
```

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `CURSOR_API_KEY` | Sim | API key do Cursor (Dashboard → Integrations ou Service Account) |
| `AZURE_DEVOPS_EXT_PAT` | Não* | PAT com Code (Read & Write) + Work Items (Read) — *obrigatório para dry-run com contexto ADO ou publicação local |
| `CURSOR_REVIEWER_MODEL` | Não | Modelo do agente (default: `composer-2.5`) |
| `CURSOR_REVIEWER_TARGET_BRANCH` | Não | Branch de comparação do diff (default: `refs/heads/master`) |
| `CURSOR_REVIEWER_BOT_TAG` | Não | Tag do bot na PR (default: `[Cursor Reviewer]`) |
| `CURSOR_REVIEWER_MAX_ROUNDS` | Não | Orçamento de rodadas fix→review antes de escalar para revisão humana (default: `5`; `0` desabilita). Ao exceder, com issues abertas, o runner publica só `critical`, suprime warnings/suggestions e registra um aviso de handoff humano numa thread de estado de rodada. |
| `CURSOR_REVIEWER_VERBOSE` | Não | Logs verbosos (default: `true`) |
| `CURSOR_REVIEWER_TIMEOUT_MS` | Não | Timeout do agente em ms (default: `600000` — 10 min); ao estourar, o run é **cancelado** via `run.cancel()` |
| `CURSOR_REVIEWER_SANDBOX` | Não | Sandbox read-only do SDK (default: `true`); `false` desativa só para depuração local. Em ambientes sem suporte a sandbox (ex.: agentes de CI), o runner cai automaticamente para execução sem sandbox |
| `CURSOR_REVIEWER_DRY_RUN` | Não | Dry-run via env (default: `false`; prefira `--dry-run`; exit 0 salvo erro) |
| `CURSOR_REVIEWER_ADO_ORG` | Não | Org ADO (local; pipeline infere de `SYSTEM_COLLECTIONURI`) |
| `CURSOR_REVIEWER_ADO_PROJECT` | Não | Projeto ADO |
| `CURSOR_REVIEWER_ADO_REPO` | Não | Repositório ADO |
| `CURSOR_REVIEWER_PR_ID` | Não | ID da PR |
| `CURSOR_REVIEWER_REPO_ROOT` | Não | Caminho para a raiz do repositório/projeto a ser analisado (default: `demo-project` relativo à raiz do runner). O runner valida que o caminho contém um diretório Git válido (com pasta `.git`). |

O carregamento do `.env` é feito via `tsx --env-file-if-exists=.env` nos scripts npm.

### Alterar o modelo LLM do agente

O modelo é passado ao Cursor SDK como `model: { id: ... }` em `src/agent/stream.ts`. A resolução segue esta ordem de prioridade:

1. **CLI** — `--model <id>` (sobrescreve tudo)
2. **Variável de ambiente** — `CURSOR_REVIEWER_MODEL`
3. **Default** — `composer-2.5` (ID canônico do SDK; não use aliases legados como `composer`, `composer-latest` ou `composer-2`)

**Local (`.env`):**
```bash
CURSOR_REVIEWER_MODEL=composer-2.5
```

**Local (flag pontual):**
```bash
npm run review -- --dry-run --model claude-4.6-sonnet-medium-thinking
```

**Azure Pipelines (variable group ou variáveis da pipeline):**
1. Em **Pipelines → Library**, adicione a variável `CURSOR_REVIEWER_MODEL` com o ID do modelo desejado.
2. O step `Run Cursor Reviewer Agent` já repassa `CURSOR_REVIEWER_MODEL: $(CURSOR_REVIEWER_MODEL)` para o runner.

IDs comuns (consulte `Cursor.models.list()`): `composer-2.5` (default, canônico), `composer-2.5-fast`, `claude-4.6-sonnet-medium-thinking`, `gpt-5.4-medium`. Aliases `composer` / `composer-2` redirecionam internamente — prefira o ID canônico.

---

## Azure Pipelines — configuração e publicação

O projeto inclui um **template de pipeline pronto para uso**: [`azure-pipelines-cursor-code-review.yml`](azure-pipelines-cursor-code-review.yml). Copie-o para a **raiz do seu repositório** e ajuste as variáveis marcadas com `← CONFIGURE`.

### Quick Start

```bash
cp azure-pipelines-cursor-code-review.yml /caminho/do/seu-repo/
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
| `CURSOR_REVIEWER_TARGET_BRANCH` | Opcional | Branch de comparação do diff (default: `refs/heads/master`). |
| `CURSOR_REVIEWER_MODEL` | Opcional | Modelo LLM do agente (default: `composer-2.5`). |

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

| Variável | Uso |
|----------|-----|
| `SYSTEM_PULLREQUEST_SOURCEBRANCH` | Branch source da PR |
| `SYSTEM_PULLREQUEST_TARGETBRANCH` | Branch target (fallback) |
| `SYSTEM_PULLREQUEST_PULLREQUESTID` | ID da PR |
| `SYSTEM_COLLECTIONURI` | URI da org ADO |
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

---

## Estrutura do projeto

```
./
├── .env                    # Variáveis locais (gitignored)
├── .env.example            # Template do .env
├── package.json            # Scripts npm
├── tsconfig.json
├── docs/                   # Documentação complementar
│   ├── flow-analysis.md    # Fluxo de análise e decisão
│   ├── faq.md              # FAQ do processo de review
│   ├── score_calc.md       # Score 0–10 e severidade
│   └── two-phase-execution-model.md
├── skills/                 # Prompts customizáveis
│   ├── SYSTEM_PROMPT.md    # Contrato portável (read-only + JSON)
│   └── CODE_REVIEW.md      # Roteamento para harness do projeto
├── run-local.ps1           # Atalho PowerShell
├── run-local.sh            # Atalho Bash
├── README.md
└── src/
    ├── index.ts            # Orquestração + gate
    ├── config.ts           # CLI args + env + padrões include/exclude
    ├── project.ts          # Resolução de runnerRoot/repoRoot + layout
    ├── logger.ts           # Logger estruturado
    ├── agent/              # Runner, prompt, stream, model, log-prompt, token-usage
    ├── ado/                # Cliente ADO, validação, publicação, round-state
    ├── git/                # Diff, filtros, marcadores
    ├── parser/             # Parse da resposta JSON do agente
    ├── project/            # Rules map
    └── seed/               # Fixtures de teste E2E
```

---

## Execução Remota e Distribuição (Branch Release)

Para evitar clonar todo o código-fonte, dependências de desenvolvimento (como TypeScript, compilers) e ter que compilar o projeto em pipelines de outros repositórios, o `cursor-reviewer` suporta uma estratégia de distribuição baseada na branch `release`.

### 1. Como funciona a branch `release`
A branch `release` contém apenas o código JavaScript transpilado pronto para execução (`dist/`), prompts (`skills/`), e os arquivos de manifesto do NPM (`package.json`, `package-lock.json`).

Para gerar e publicar essa branch automaticamente a partir do código na `main`, use:
```bash
npm run build:release
```
Esse script compila o projeto, cria um repositório git temporário contendo apenas os artefatos de runtime e faz um force push para a branch `release` do repositório remoto configurado.

### 2. Executando o Reviewer remotamente a partir de outro projeto
Projetos externos podem baixar e executar a última versão de release do `cursor-reviewer` sem precisar incluir seus arquivos no repositório local.

O script `run.sh` na raiz deste repositório automatiza esse fluxo. Ele clona a branch `release` em um diretório temporário local, instala as dependências mínimas de runtime (`npm ci --omit=dev`), e executa o agente no contexto do projeto chamador.

#### Exemplo em Pipeline (cURL + Bash)
Basta baixar o script `run.sh` de release e executá-lo passando as opções da CLI (a variável `CURSOR_REVIEWER_REPO_URL` pode ser usada caso o repositório seja privado ou hospedado no Azure DevOps Git):

```bash
# Caso o repositório seja público no GitHub:
curl -fsSL https://raw.githubusercontent.com/jpolvora/cursor-reviewer/main/run.sh | bash -s -- --dry-run

# Customizando a URL do repositório (ex: repositório privado no Azure DevOps) e passando argumentos:
export CURSOR_REVIEWER_REPO_URL="https://dev.azure.com/sua-organizacao/seu-projeto/_git/cursor-reviewer"
curl -fsSL -H "Authorization: Bearer $SYSTEM_ACCESSTOKEN" "https://dev.azure.com/sua-organizacao/seu-projeto/_apis/git/repositories/cursor-reviewer/items?path=/run.sh&api-version=6.0" | bash -s -- --dry-run
```

O script repassará todos os argumentos (como `--dry-run`, `--org`, `--pr-id`, etc.) diretamente para o executável do `cursor-reviewer`.

---

## Como rodar localmente

### Pré-requisitos

- Node.js 22.13+
- `npm install`
- `.env` com `CURSOR_API_KEY` válida

### Dry-run básico

```bash
npm run review -- --dry-run
```

### Testando com o Projeto Demo (crud-simples)

O repositório inclui uma pasta de demonstração em `demo-project/crud-simples` contendo arquivos C# e TypeScript com erros de segurança e qualidade propositais (como SQL Injection, XSS, Memory Leaks e descarte inadequado de recursos).

Para rodar a análise local contra esse projeto demo e validar que o bot detecta os problemas corretamente, execute:
```bash
npm run review -- --dry-run --include-uncommitted --repo-root demo-project/crud-simples
```

A flag `--include-uncommitted` é necessária para instruir o analisador Git a incluir arquivos que não estão commitados no branch (ou arquivos novos no working tree), e `--repo-root` aponta o escopo da análise especificamente para a pasta do projeto demo.

### Opções CLI avançadas

```bash
# Branch específica
npm run review -- --dry-run --source-branch refs/heads/nome-da-feature

# Target customizado
npm run review -- --dry-run --source-branch refs/heads/feat/x --target-branch refs/heads/develop

# Incluir arquivos não commitados
npm run review -- --dry-run --include-uncommitted

# Validação seed
npm run review -- --dry-run --seed-test

# Gate completo com contexto ADO real
npm run review -- --dry-run --source-branch refs/heads/sua-feature --org sua-org --project MeuProjeto --repo MeuRepo --pr-id 123
```

### Publicação real (local)

Requer contexto ADO completo **e** token (sem `--dry-run`):

```bash
npm run review -- --source-branch refs/heads/sua-feature --org sua-org --project MeuProjeto --repo MeuRepo --pr-id 123
```

---

## Atalhos shell

**Bash** (`run-local.sh`):
```bash
./run-local.sh                          # menu interativo
./run-local.sh feat/minha-feature       # source explícita
./run-local.sh feat/x refs/heads/develop  # source + target
```

**PowerShell** (`run-local.ps1`):
```powershell
.\run-local.ps1
.\run-local.ps1 -SourceBranch feat/minha-feature
.\run-local.ps1 -SourceBranch feat/x -TargetBranch refs/heads/develop
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
| `--repo-root PATH` | Caminho para a raiz do repositório/projeto a ser analisado (default: `demo-project`) |
| `--help` / `-h` | Ajuda |

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

Campos `score` (6–10), `developerAction` (`fix-code` ou `escalate`), `analysis` e `impactPaths` são **obrigatórios** em cada review publicável. `suggestedFix` é opcional (bloco de código por linguagem — ` ```csharp ` / ` ```ts ` / ` ```diff `; **não** ` ```suggestion `, que o Azure DevOps não aplica). Reviews com score ≤ 5 ou campos obrigatórios ausentes são descartados pelo gate em `src/ado/review-validation.ts`.

---

## Seed issues (teste local)

Fixtures temporárias em disco (`seed:install` → review com `--seed-test` → `seed:uninstall`). Consulte [`SEED-ISSUES.md`](SEED-ISSUES.md) para cenários, execução e checklist de limpeza.

---

## Troubleshooting

### `CURSOR_API_KEY é obrigatório`
Confirme que `.env` existe e está preenchido. Use `npm run review` (carrega `--env-file=.env` automaticamente).

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
| Fluxo de análise e decisão | `docs/flow-analysis.md` |
| FAQ | `docs/faq.md` |
| Score e severidade | `docs/score_calc.md` |
| System Prompt / contrato JSON | `skills/SYSTEM_PROMPT.md` |
| Instruções de harness | `skills/CODE_REVIEW.md` |
| Pipeline YAML | `azure-pipelines-cursor-code-review.yml` |
| Cursor SDK Docs | https://cursor.com/docs/sdk/typescript |
