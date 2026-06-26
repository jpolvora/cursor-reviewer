# Cursor Reviewer — Code Review Agêntico (Review-Only)

O **Cursor Reviewer** é um revisor de Pull Requests automatizado e portável para **Azure DevOps** e **GitHub**. Ele utiliza o [**Cursor SDK**](https://cursor.com/docs/sdk/typescript) (`@cursor/sdk`) em modo agêntico para realizar análises profundas diretamente no diff do repositório, guiado pelo harness do projeto (regras do `.cursor/rules/`, `AGENTS.md` e instruções de code-review). 

O revisor atua **exclusivamente em modo de leitura (review-only)**, publicando threads acionáveis nas linhas afetadas da PR. Ele **não altera arquivos no repositório**. A decisão final de aplicar a correção sugerida ou encerrar a thread é sempre do desenvolvedor.

> [!IMPORTANT]
> **Modo Somente Leitura:** O agente opera dentro de um ambiente seguro e controlado. Ele está tecnicamente impedido de realizar commits, push, formatar código ou executar scripts modificadores no repositório.

---

## 📖 Documentação Complementar (`docs/`)

Para detalhes arquiteturais e teóricos profundos, consulte a pasta [`docs/`](docs/):

*   **[Fluxo de Análise e Decisão](docs/flow-analysis.md):** Guia completo de ciclo de vida, do carregamento de contexto ao gate final.
*   **[Perguntas Frequentes (FAQ)](docs/faq.md):** Dúvidas comuns de configuração, comportamento do bot e regras.
*   **[Cálculo de Score e Severidade](docs/score_calc.md):** Rubrica detalhada do score (0–10) e severidades (`critical`, `warning`, `suggestion`).
*   **[Modelo de Execução em Duas Fases](docs/two-phase-execution-model.md):** Detalhes sobre a arquitetura de triagem e investigação profunda em um único agente.

---

## 🚀 Recursos Principais e Novidades

*   **🔌 Integração Multiprovedor (Azure DevOps & GitHub):** Suporte nativo a ambas as plataformas. O provedor correto é inferido automaticamente pelas variáveis de CI ou pode ser forçado pelas flags CLI (`--ado` ou `--gh`).
*   **🧠 Memória Intra-PR e Agrupamento de Ocorrências (Anti Whack-a-mole):** O agente retém os padrões de erros passados da PR em seu contexto para caçar ativamente falhas recorrentes. Ao encontrar o mesmo erro espalhado pelo diff, ele agrupa as ocorrências (`relatedOccurrences`), sendo desdobradas pela pipeline em múltiplas threads sincronizadas publicadas de uma única vez.
*   **🗂️ Seleção e Autodetecção de Stacks Tecnológicas:** Permite executar a revisão focando nas extensões de arquivos e com recomendações de boas práticas específicas da stack selecionada (via `--stack` ou env `CURSOR_REVIEWER_STACK`). Caso nenhuma stack seja configurada, o runner tenta autodetectar a tecnologia analisando os arquivos da raiz do projeto (ex.: presença de `artisan`, `next.config.js`, `tsconfig.json` ou arquivos `.sln`/`.csproj`), caindo para `ABP/Angular` como fallback. O log indica explicitamente de onde a definição da stack foi carregada.
*   **📝 Sugestões Interativas:** 
    *   No **GitHub**, as correções sugeridas utilizam o formato nativo ` ```suggestion `, permitindo que o desenvolvedor aplique a correção na PR com um único clique.
    *   No **Azure DevOps**, que não suporta o recurso de sugestão interativa, as cercas são normalizadas automaticamente para blocos de código neutros (` ```csharp `, ` ```ts `, etc.), garantindo uma formatação limpa.
*   **⚖️ Garantia de Convergência (Orçamento de Rodadas):** Utiliza um contador de rodadas persistido em um comentário de estado (`<!-- reviewer-round-state -->`). Se as rodadas excederem o limite (default: 5) e continuarem ocorrendo issues abertas, o bot entra em **escalonamento**: publica apenas issues de severidade `critical` (segurança/quebra de negócio) e adiciona um aviso solicitando **revisão humana**.
*   **🔍 Mapeamento Automático de Regras:** Lê e filtra arquivos de regras locais `.cursor/rules/*.mdc` associados aos arquivos alterados no diff antes do início da análise pelo agente.
*   **📊 Relatórios e Visibilidade na Build:** 
    *   **Azure DevOps:** Emite logging commands (`##vso[task.logissue]`) e anexa um resumo markdown rico na tela de build (`##vso[task.uploadsummary]`).
    *   **GitHub:** Anexa um resumo markdown completo da revisão diretamente na página do workflow via `GITHUB_STEP_SUMMARY`.
*   **📦 Execução Remota via cURL:** Permite rodar o reviewer remotamente baixando apenas o script `run.sh` da branch `release`, dispensando o clone completo do repositório ou a presença de dependências de desenvolvimento.
*   **🤖 Skills agênticas do runner (`.agents/skills/`):** Skills versionadas neste repositório para uso no Cursor/IDE ao desenvolver ou operar o `cursor-reviewer`:
    *   **`code-review-self`** — Executa o pipeline de review (duas fases, gate, rodadas) pelo próprio agente do IDE, sem `@cursor/sdk`; útil para dry-run local e validação do comportamento do runner.
    *   **`megabrain`** — Revisão com threads persistentes (`[Thread #1]`, `[Thread #2]`, …); em rodadas seguintes avalia se cada thread foi `RESOLVED` ou permanece `UNRESOLVED`.
    *   **`solve-pr`** — Automatiza o ciclo de correção: busca threads do bot no GitHub, aplica fixes, commit/push e aguarda nova rodada do reviewer.

---

## 🛠️ Configuração de Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as chaves necessárias (veja [.env.example](.env.example)):

```bash
cp .env.example .env
```

| Variável | Tipo / Padrão | Descrição |
| :--- | :--- | :--- |
| `CURSOR_API_KEY` | **Obrigatório** | Chave de API do painel do Cursor (Integrations / Service Account). |
| `AZURE_DEVOPS_EXT_PAT` | Opcional | PAT do ADO com permissão de escrita em Code e leitura em Work Items. |
| `GITHUB_TOKEN` ou `GH_TOKEN` | Opcional | Token de acesso para APIs do GitHub (REST/GraphQL). |
| `CURSOR_REVIEWER_MODEL` | `composer-2.5` | Modelo LLM utilizado pelo agente (ex: `composer-2.5-fast`, `claude-4.6-sonnet-medium-thinking`). |
| `CURSOR_REVIEWER_ENGINE` | `cursor-sdk` | Engine de execução LLM (`cursor-sdk` ou `opencode` — stub). |
| `CURSOR_REVIEWER_TARGET_BRANCH`| `refs/heads/master` | Branch de comparação para gerar o diff git. |
| `CURSOR_REVIEWER_BOT_TAG` | `[Cursor Reviewer]` | Tag de identificação do bot nos comentários da PR. |
| `CURSOR_REVIEWER_MAX_ROUNDS` | `5` | Limite de iterações de correções antes do handoff humano (`0` desativa). |
| `CURSOR_REVIEWER_TIMEOUT_MS` | `600000` (10 min) | Tempo limite de execução da sessão do agente. |
| `CURSOR_REVIEWER_REPO_ROOT` | — | Raiz do repositório alvo a revisar (default: detectado dinamicamente). |
| `CURSOR_REVIEWER_REVIEW_SELF` | `false` | Se `true`, permite que o reviewer revise os próprios arquivos (apenas para desenvolvimento). |
| `CURSOR_REVIEWER_STACK` | `ABP/Angular` | Stack de desenvolvimento ativa (`ABP/Angular`, `PHP/Laravel`, `Next.js/React`, `TypeScript`, `Custom`). |
| `CURSOR_REVIEWER_CUSTOM_PROMPT` | — | Caminho do arquivo ou string de prompt quando a stack é `Custom` (requerido para stack `Custom`). |
| `CURSOR_REVIEWER_INCLUDE_PATTERNS` | — | Lista separada por vírgulas de padrões glob de inclusão (ex.: `**/*.py,**/*.go`). Sobrescreve o default da stack. |

---

## 💻 Uso e Parâmetros da CLI

Para rodar localmente ou customizar a execução em scripts:

```bash
npm run review -- [argumentos]
```

### Argumentos da CLI

*   `--dry-run` : Simula toda a execução, gerando o JSON de reviews no console e renderizando previews estruturados das threads, sem publicar nada na PR real.
*   `--include-uncommitted` : Inclui alterações não commitadas (staged/unstaged/untracked) no escopo do diff vs HEAD.
*   `--seed-test` : Roda a suite de validação local de detecção baseada no arquivo `SEED-ISSUES.md`.
*   `--source-branch <REF>` : Sobrescreve localmente a branch de origem.
*   `--target-branch <REF>` : Sobrescreve a branch de destino do diff (ex: `refs/heads/develop`).
*   `--repo-root <CAMINHO>` : Define o diretório do repositório Git alvo (deve conter uma pasta `.git` válida).
*   `--ado` ou `--gh` : Força a plataforma do provedor (Azure DevOps ou GitHub).
*   `--org <NOME>`, `--project <NOME>`, `--repo <NOME>`, `--pr-id <ID>` : Passa o contexto do repositório e ID da Pull Request explicitamente para execução local.
*   `--stack <NOME>` ou `--stack=<NOME>` : Define a stack tecnológica ativa para o review (`ABP/Angular`, `PHP/Laravel`, `Next.js/React`, `TypeScript`, `Custom`).
*   `--custom-prompt <VAL>` : Caminho do arquivo ou string de prompt quando a stack é `Custom` (requerido para `--stack=Custom`).
*   `--include-patterns <VAL>` : Lista separada por vírgulas de padrões glob de inclusão (ex.: `**/*.py,**/*.go`). Sobrescreve o padrão de arquivos a incluir no diff.

---

## 🔄 Fluxo de Execução

```
[PR Aberta/Atualizada]
        │
        ▼
[Preparar Workspace Git] ──► Filtra tipos de arquivos de acordo com a stack (ou --include-patterns)
        │
        ▼
[Coletar Contexto do Provedor] ──► Work Items linkados + Threads de bot existentes
        │
        ▼
[Agente Cursor (2 Fases)]
   ├─ Fase 1: Triagem ──► Identifica linhas alteradas e elabora hipóteses de falhas
   └─ Fase 2: Investigação ──► Prova/refuta hipóteses usando tools (read, grep, rules locales)
        │
        ▼
[Gate de Validação] ──► Filtra reviews inválidos ou com score ≤ 5
        │
        ▼
[Publicação na PR]
   ├─ Azure DevOps: Normaliza cercas e publica threads + Estado da Rodada
   └─ GitHub: Mantém ```suggestion e anexa resumo no GITHUB_STEP_SUMMARY
        │
        ▼
[Fim da Execução] ──► Exit 0 (sucesso/issues encontradas) ou Exit 1 (falhas de sistema)
```

---

## 🗂️ Seleção e Autodetecção de Stacks

O Cursor Reviewer permite focar a análise em arquivos elegíveis específicos e injetar recomendações de boas práticas direcionadas para cada ecossistema tecnológico.

### ⚙️ Como Definir a Stack
Você pode definir a stack de três formas (em ordem de prioridade):
1.  **Parâmetro CLI:** `--stack=<nome-da-stack>` (ex.: `--stack=PHP/Laravel`).
2.  **Variável de Ambiente:** `CURSOR_REVIEWER_STACK=<nome-da-stack>`.
3.  **Autodetecção Automática:** Caso não seja especificada nenhuma das opções anteriores.

### 🎨 Stack Customizada (`Custom`) e Prompt Customizado

Se você precisa rodar o revisor em um projeto cuja tecnologia/stack não está pré-definida nas opções padrão, ou se deseja ter total controle das diretrizes de revisão da stack, você pode utilizar a stack `Custom`.

Quando a stack `Custom` é selecionada, o Cursor Reviewer:
1. **Requer** que você informe um prompt customizado via `--custom-prompt` (ou pela variável `CURSOR_REVIEWER_CUSTOM_PROMPT`).
2. Adota, por padrão, a inclusão de todos os arquivos (`**/*`) no diff de revisão, a menos que seja definido o parâmetro `--include-patterns` (ou a variável `CURSOR_REVIEWER_INCLUDE_PATTERNS`).

#### Exemplos de Linhas de Comando:

* **Exemplo 1: Passando o caminho de um arquivo de prompt customizado (recomendado para CI):**
  ```bash
  npm run review -- --dry-run --stack=Custom --custom-prompt=./my-pipeline-prompt.md
  ```

* **Exemplo 2: Passando o prompt diretamente como string:**
  ```bash
  npm run review -- --dry-run --stack=Custom --custom-prompt="Evite o uso de variáveis globais e garanta tipagem estrita de retorno em todas as funções públicas."
  ```

* **Exemplo 3: Limitando os arquivos analisados pela stack customizada (por exemplo, Python e Go):**
  ```bash
  npm run review -- --dry-run --stack=Custom --custom-prompt=./custom-rules.md --include-patterns="**/*.py,**/*.go"
  ```

* **Exemplo 4: Utilizando variáveis de ambiente (comum em arquivos de Pipeline/GitHub Actions):**
  ```bash
  export CURSOR_REVIEWER_STACK="Custom"
  export CURSOR_REVIEWER_CUSTOM_PROMPT="./config/reviewer-prompt.md"
  export CURSOR_REVIEWER_INCLUDE_PATTERNS="**/*.rs,**/*.toml"
  npm run review -- --dry-run
  ```

### 🔍 Estratégia de Autodetecção
Quando ativada, a estratégia de autodetecção analisa a raiz do repositório (`repoRoot`) e infere a tecnologia baseada nas seguintes regras:
*   **PHP/Laravel:** Identificado se houver o arquivo `artisan` ou `composer.json` na raiz.
*   **Next.js/React:** Identificado por arquivos como `next.config.js` / `.mjs` / `.ts` ou pelo pacote `next` nas dependências do `package.json`.
*   **ABP/Angular:** Identificado por arquivos `angular.json`, diretório `angular/` ou pelo pacote `@angular/core`.
*   **C#/.NET (ABP/Angular):** Identificado por soluções `.sln` ou arquivos `.csproj` na raiz.
*   **TypeScript:** Identificado por `tsconfig.json` ou pelos pacotes `typescript` / `tsx`.

> [!TIP]
> **Ordem de Precedência na Detecção:** Arquivos de solução C# `.sln` e `.csproj` são checados *antes* de `tsconfig.json` genéricos. Isso garante que backends ABP/.NET Core que possuam um `tsconfig` na raiz para fins de tooling não sejam erroneamente detectados como TypeScript puro.

### 🔄 Fallback e Segurança
*   **Fallback Padrão:** Se nenhuma tecnologia for autodetectada ou especificada, o runner adota a stack `ABP/Angular` (mantendo 100% de compatibilidade com o comportamento original).
*   **Tratamento de Macros ADO:** Caso a variável de ambiente `CURSOR_REVIEWER_STACK` contiver uma macro não expandida do Azure DevOps (como `$(CURSOR_REVIEWER_STACK)`), ela será resolvida automaticamente para a stack padrão.
*   **Seed Tests:** Ao rodar a suíte local com a flag `--seed-test`, o runner força a execução na stack `ABP/Angular` para garantir a detecção correta das fixtures C#/.NET.

### 🔌 Como Estender e Adicionar Nova Stack
A arquitetura é modular e extensível. Para adicionar suporte a uma nova stack tecnológica:
1.  **Registrar no Config:** Abra `src/config.ts` e adicione a nova definição ao dicionário `STACKS`, mapeando o nome amigável, os padrões de arquivos do diff (`includePatterns`) e o nome do arquivo de prompt (ex.: `meu-framework.md`).
2.  **Mapear o Alias:** No mesmo arquivo, atualize a função `getStackConfig` com as chaves e aliases de normalização da sua stack.
3.  **Criar o Prompt:** Crie o arquivo markdown correspondente em `skills/stacks/meu-framework.md` detalhando as instruções específicas e preocupações comuns de revisão de código para aquela tecnologia.

---

### Skills locais do `cursor-reviewer`

As skills em `.agents/skills/` deste repositório são locais ao runner. Invocáveis no Cursor com `/code-review-self`, `/megabrain` ou `/solve-pr` quando anexadas à conversa:

| Skill | Quando usar |
| :--- | :--- |
| `code-review-self` | Revisar diff/PR localmente pelo agente do IDE, espelhando `src/index.ts` em modo somente-leitura |
| `megabrain` | Revisão iterativa com threads numeradas; follow-up após commits de correção |
| `solve-pr` | Implementar correções das threads abertas do bot e republicar na PR |

> [!TIP]
> Para obter mais informações sobre outras diretrizes e skills genéricas reutilizáveis (como `code-review` ou `fix-pr`), consulte o repositório centralizado [workflow-skills](https://github.com/jpolvora/workflow-skills).

---

## 🌐 Integração em CI/CD

### 1. Azure Pipelines (Azure DevOps)

Utilize o template pronto do projeto: [`azure-pipelines-cursor-code-review.yml`](azure-pipelines-cursor-code-review.yml). 

1. Copie o arquivo para a raiz do seu repositório Git alvo.
2. Certifique-se de criar um **Variable Group** (ex: `vg-cursor-reviewer`) no Azure DevOps contendo a variável secreta `CURSOR_API_KEY`.
3. Garanta que o **Build Service** da sua pipeline tenha permissão de **Contribute to pull requests** nas configurações do repositório.
4. Habilite a opção **Allow scripts to access the OAuth token** nas configurações de execução do job da pipeline.
5. Configure uma branch policy de **Build Validation** apontando para esta pipeline.

### 2. GitHub Actions

Para o GitHub Actions, você pode rodar a ferramenta diretamente baixando o script de execução remota, alimentado com as variáveis e permissões do repositório:

```yaml
name: Cursor Code Review

on:
  pull_request:
    branches: [ main, develop ]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    steps:
      - name: Checkout Code
        uses: actions/checkout@v5
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 22.13.x

      - name: Run Reviewer Agent
        env:
          CURSOR_API_KEY: ${{ secrets.CURSOR_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          curl -fsSL https://raw.githubusercontent.com/jpolvora/cursor-reviewer/main/run.sh | bash -s -- --gh --pr-id ${{ github.event.pull_request.number }}
```

---

## 📦 Execução Remota via cURL (`run.sh`)

O script `run.sh` permite executar o **Cursor Reviewer** em qualquer repositório sem a necessidade de clonar o projeto do runner manualmente ou instalar dependências de desenvolvimento locais de forma permanente. 

O script realiza as seguintes etapas de forma silenciosa:
1. Clona a branch `release` (contendo exclusivamente os artefatos compilados em JS do runner) em um diretório temporário local (`.tmp-cursor-reviewer`).
2. Instala apenas as dependências de produção necessárias de runtime (`npm ci --omit=dev`).
3. Executa o agente direcionando o escopo de análise para a pasta atual e repassa todos os argumentos CLI.
4. Remove o diretório temporário automaticamente ao concluir ou interromper o processo.

### 🚀 Estrutura de Execução Básica

Você pode invocar o runner passando opções CLI usando o operador `--` após a chamada do bash:

```bash
curl -fsSL https://raw.githubusercontent.com/jpolvora/cursor-reviewer/main/run.sh | bash -s -- [OPÇÕES]
```

> [!IMPORTANT]
> A variável de ambiente `CURSOR_API_KEY` deve estar exposta no terminal de execução para que o agente consiga autenticar no Cursor SDK.

### 📋 Principais Opções de Linha de Comando (Forwarded Arguments)

Todos os argumentos passados após `--` são repassados ao indexador do Cursor Reviewer. A lista completa de opções suportadas inclui:

| Parâmetro | Descrição |
| :--- | :--- |
| `--dry-run` | Executa o review simulado sem publicar threads ou comentários na PR (útil para testes locais). |
| `--verbose` | Exibe logs detalhados de depuração sobre o diff git, tokens e carregamento de regras. |
| `--gh` / `--ado` | Força a plataforma de destino como **GitHub** ou **Azure DevOps**, respectivamente (autodetectado em ambientes CI). |
| `--pr-id <ID>` | ID da Pull Request a ser revisada (obrigatório para publicação de threads). |
| `--stack <nome>` | Define a stack tecnológica para focar a revisão com prompts especializados. Opções: `typescript`, `nextjs/react`, `php/laravel`, `abp/angular` ou `custom`. |
| `--custom-prompt <caminho>` | String de prompt ou caminho para arquivo markdown (obrigatório se `--stack custom` for selecionado). |
| `--target-branch <branch>` | Branch de comparação para gerar o diff (Padrão: `refs/heads/master`). |
| `--include-patterns <csv>` | Lista de padrões glob de inclusão de arquivos separados por vírgula (ex: `**/*.ts,**/*.cs`). |
| `--include-uncommitted` | Inclui arquivos modificados não commitados na análise (staged/unstaged). |
| `--bot-tag <tag>` | Tag identificadora de comentários feita pelo bot (Padrão: `[Cursor Reviewer]`). |
| `--model <id>` | ID do modelo LLM do Cursor a utilizar (Padrão: `composer-2.5`). |

---

### 💡 Exemplos de Uso

#### 1. Simulação Local (Dry-Run) com Stack TypeScript
Analisa o diff local contra a branch `master` usando boas práticas de TypeScript sem publicar nada:
```bash
export CURSOR_API_KEY="sua_chave_aqui"
curl -fsSL https://raw.githubusercontent.com/jpolvora/cursor-reviewer/main/run.sh | bash -s -- --dry-run --stack typescript
```

#### 2. Executando Localmente com Comparação a Branch `develop` e Inclusão de Uncommitted Changes
```bash
export CURSOR_API_KEY="sua_chave_aqui"
curl -fsSL https://raw.githubusercontent.com/jpolvora/cursor-reviewer/main/run.sh | bash -s -- --dry-run --target-branch refs/heads/develop --include-uncommitted
```

#### 3. Integração Manual no GitHub Actions (Exemplo de Workflow)
Para executar remotamente na pipeline do GitHub Actions enviando os dados da PR:
```yaml
- name: Run Reviewer Agent
  env:
    CURSOR_API_KEY: ${{ secrets.CURSOR_API_KEY }}
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    curl -fsSL https://raw.githubusercontent.com/jpolvora/cursor-reviewer/main/run.sh | bash -s -- --gh --pr-id ${{ github.event.pull_request.number }}
```

#### 4. Integração no Azure Pipelines (Azure DevOps)
Executa remotamente especificando a organização e projeto:
```yaml
- script: |
    curl -fsSL https://raw.githubusercontent.com/jpolvora/cursor-reviewer/main/run.sh | bash -s -- --ado --org "MinhaOrg" --project "MeuProjeto" --repo "MeuRepo" --pr-id $(System.PullRequest.PullRequestId)
  env:
    CURSOR_API_KEY: $(CURSOR_API_KEY)
    SYSTEM_ACCESSTOKEN: $(System.AccessToken)
  displayName: 'Executar Cursor Reviewer via cURL'
```

---

## 🧑‍💻 Execução e Testes Locais

### Pré-requisitos
*   Node.js instalado (versão **22.13+**).
*   Chave `CURSOR_API_KEY` preenchida no arquivo `.env`.

### Comandos Úteis

| Comando | Descrição |
| :--- | :--- |
| `npm install` | Instala todas as dependências locais. |
| `npm run review:local` | Roda uma simulação (`--dry-run`) contra o diff da branch local. |
| `npm test` | Executa validações de tipo (`tsc --noEmit`) e a suite de testes unitários. |
| `npm run test:seed` | Roda o teste E2E: instala fixtures temporárias de defeito, executa a análise com agente em modo dry-run/seed e valida se todos os cenários de `SEED-ISSUES.md` foram detectados pelo agente. |
| `npm run build` | Compila o projeto TypeScript para JavaScript na pasta `dist/`. |

---

## 🗂️ Estrutura de Diretórios

*   `src/index.ts` : Orquestrador principal do fluxo de revisão.
*   `src/config.ts` : Tratamento de argumentos da CLI e resolução de parâmetros de ambiente.
*   `src/provider/` : Abstrações e integrações de APIs de plataformas (`github.ts` e `azuredevops.ts`).
*   `src/engine/` : Interface `ExecutionEngine`, factory `getEngine()` e adapters (`cursor-sdk`, `opencode` stub).
*   `src/agent/` : Montagem do prompt e orquestração da chamada ao engine injetado.
*   `src/ado/` : Regras de validação do gate, de rodadas, formatação de threads e helpers do ADO.
*   `skills/` : Contratos de prompts estáticos do agente (`SYSTEM_PROMPT.md` e `CODE_REVIEW.md`) e subpasta `skills/stacks/` contendo os prompts complementares com as recomendações de cada stack.
*   `.agents/skills/` : Skills agênticas do ecossistema do runner (`code-review-self`, `megabrain`, `solve-pr` e scripts auxiliares).
*   `demo-project/` : Projeto de demonstração contendo erros intencionais para fins de testes locais.
