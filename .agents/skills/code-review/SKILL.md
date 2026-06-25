---
name: code-review
description: Code review local rigoroso e genérico comparando a branch atual com a principal. Análise em duas fases (triagem → investigação com tools) com prova por evidência e generalização por classe de defeito. Autodetecta a stack do repositório em execução.
version: 2.0
---

# 🕵️‍♂️ Code Reviewer Skill (Local & CI/CD Simulation)

Atue como um **Revisor de Código Sênior**, replicando localmente o rigor e a metodologia de um revisor agêntico de PR (análise em duas fases, prova por evidência via tools, generalização por classe de defeito). 

Seu objetivo é encontrar erros críticos, classificar apontamentos por severidade e permitir a resolução local de falhas antes de enviar a PR para o repositório remoto.

---

## 🎯 Propósito Anti-Loop (Prioridade Máxima)

Esta skill ajuda a **quebrar o ciclo infinito `fix → review → novos problemas → fix...`**. Para isso, siga a regra de **precisão por achado + completude na mesma rodada**:

- **Precisão:** Publique apenas o que for **comprovável** com evidência estruturada (precisão alta; na dúvida sobre se um achado é real, mantenha silêncio).
- **Completude:** Enumere **todos** os achados materiais **de uma só vez** — não reserve achados para "a próxima rodada". Sub-reportar é o que cria o loop.
- **Classe, não instância:** Ao confirmar um defeito, varra ocorrências irmãs do mesmo padrão no diff e reporte todas juntas.

Convergência alvo: **uma única rodada** — ou a lista completa de problemas reais, ou **"Sem feedback"**.

---

## 🔍 Fase 0 — Autodetecção de Stack e Ecossistema

Antes de analisar o código, inspecione a estrutura do repositório na raiz para identificar a stack tecnológica e adaptar os critérios de review:

1. **Procure arquivos estruturais:**
   - `.csproj`, `.sln` $\rightarrow$ **C# / .NET** (Verifique se há referências a `Volo.Abp` no código para suporte ao **ABP Framework**).
   - `package.json`, `tsconfig.json`, `angular.json` $\rightarrow$ **TypeScript / Angular**.
   - `package.json`, `tsconfig.json` (com dependências de React, Next, Vue ou Svelte) $\rightarrow$ **TypeScript / Frontend Moderno**.
   - `requirements.txt`, `pyproject.toml`, `Pipfile`, `manage.py` $\rightarrow$ **Python**.
   - `go.mod` $\rightarrow$ **Go**.
   - `pom.xml`, `build.gradle` $\rightarrow$ **Java**.
2. **Defina a lista de arquivos a revisar:**
   - Ignore arquivos markdown (`*.md`), arquivos de configuração do repositório/CI (`.gitignore`, `.github/`, pipelines), arquivos de tradução (`*.json` de i18n) e proxies ou códigos autogerados (ex: pasta `proxy/` no Angular/ABP).
3. **Consulte Regras Locais:**
   - Leia `AGENTS.md` e a pasta `.cursor/rules/` (ou regras locais de agente equivalentes) para identificar regras arquiteturais ou checklists locais impostos especificamente neste repositório.

---

## 🛠️ Como Executar o Review — Análise em Duas Fases

Faça **a Fase 1 inteira antes de iniciar a Fase 2**. Não reporte nenhum achado sem passar por ambas.

### 0. Obter o Diff Local
- Identifique a branch atual: `git branch --show-current`
- Liste os arquivos alterados contra a branch principal (`master` ou `main`):
  ```bash
  git diff --name-status master...HEAD
  ```
- Extraia o diff das linhas alteradas dos arquivos válidos para a stack detectada:
  ```bash
  git diff master...HEAD -- "caminho/do/arquivo"
  ```

### 1. Fase 1 — Triagem (Mapa de Candidatos)
Objetivo: Gerar uma lista enxuta de **hipóteses** ancoradas em linhas alteradas — ainda sem veredito.
- Para cada arquivo elegível, identifique linhas alteradas com potencial problema real.
- **Descarte imediatamente:** Nits estéticos, formatação, estilo, preferências de escrita de código, alertas conceituais sem um caminho de execução plausível de falha e código pré-existente intocado.
- Em arquivos de template/UI (ex: `*.html`, `*.tsx`, `*.vue`): Ignore estilização/layout/CSS. Candidate apenas brechas de segurança (`innerHTML`, interpolação insegura), bindings/eventos críticos, controle de formulários e permissões.
- Saída mental: Lista de candidaturas `(arquivo, linha, hipótese breve)`.

### 2. Fase 2 — Investigação Profunda + Prova (Por Candidato)
Use tools (`read_file`, `grep_search`, busca semântica) para **provar ou refutar** cada hipótese de candidatura. Para reportar um achado, você deve preencher os **4 passos da prova estruturada**:

1. **Evidência lida:** Arquivos, símbolos, chamadores, entidades ou testes inspecionados para validar o contexto.
2. **Cenário de falha executável:** Sequência de entradas ou estados concretos que disparam o problema.
3. **Proteção ausente confirmada:** Por que validações, invariants ou testes existentes no repositório **não** impedem essa falha (cite o que verificou na base de código).
4. **Descartes:** Hipóteses alternativas que foram consideradas e rejeitadas.

Se não conseguir preencher os 4 passos com provas extraídas via tools $\rightarrow$ **descarte o candidato**.

### 2.5 Generalização por Classe de Defeito (Obrigatório)
Para **cada achado comprovado**, use `grep`/`glob` para procurar **ocorrências irmãs do mesmo padrão** em outros arquivos alterados no diff e reporte todas juntas.
- Exemplo: Se faltou tratamento de valor padrão inválido (ex: `Guid.Empty` ou `DateTime.MinValue`) em um DTO alterado, verifique se outros DTOs alterados compartilham a mesma brecha.

---

## 🎯 Brechas e Gaps Comuns por Stack

### Geral (Independente de Stack)
- **Secrets e Credenciais:** Chaves de API, tokens de acesso ou secrets hardcoded ou expostos em logs.
- **Segurança (OWASP):** Falhas de autorização em endpoints públicos expostos, injeção de dados (SQL, comandos) e vazamento de dados cross-tenant.
- **Vazamento de Recursos:** Conexões abertas, arquivos não fechados ou recursos `IDisposable` não descartados.

### Stack C# / .NET (e ABP Framework se detectado)
- **Defaults Perigosos:** Validações que aceitam valores padrão inválidos do C# (ex: `DateTime.MinValue`, `Guid.Empty`, `0` quando o domínio exige dados reais). O atributo `[Required]` não valida o valor padrão de tipos de valor estruturais.
- **Performance de ORM (EF Core):** Consultas N+1 (falta de `.Include()`), materialização precoce em memória (`.ToList()` antes de filtros no banco), bloqueio assíncrono síncrono (`.Result`, `.Wait()`, `.GetAwaiter().GetResult()`).
- **ABP Framework (Se aplicável):** Uso de exceções genéricas em vez de `BusinessException`, falta de validação de permissões com `[Authorize(Permission)]`, violação de regras DDD (Application Layer acessando ou injetando `DbContext` diretamente).

### Stack JavaScript / TypeScript (Angular, React, Node.js)
- **Segurança de UI:** Uso inseguro de manipulação direta de DOM (`innerHTML` ou bindings equivalentes que ignoram sanitização).
- **Vazamentos de Memória:** Subscriptions RxJS não desinscritas (`takeUntil`, `Subscription.unsubscribe()`), dependências incorretas de hooks em React (ex: `useEffect` sem cleanup ou com dependências mutáveis instáveis).
- **Angular/TypeScript (Se aplicável):** Falta de validação de payloads em base64 antes de chamadas como `atob()`, proxies autogerados modificados manualmente.

---

## 📝 Formato do Relatório (Saída)

Responda sempre em **Português do Brasil**.

Se não houver problemas materiais a relatar, responda **apenas**:
> **Sem feedback**

Se houver apontamentos, utilize a estrutura abaixo. Adicione links de arquivos clicáveis no formato `[Arquivo.cs:L42](file:///caminho/do/Arquivo.cs#L42)` e use blocos de sugestão ````suggestion```` para propor a correção inline exata. 

```markdown
## 📊 Resumo do Code Review (Simulação da Pipeline)

**Branch Atual:** `[Nome da Branch]`
**Stack Identificada:** `[Stack/Ecossistema]`
**Arquivos Revisados:** `[Quantidade]`

---

### 🚨 Problemas Críticos (`critical`)
- **[NomeDoArquivo.ext:L42](file:///absolute/path/to/NomeDoArquivo.ext#L42)**: 🛑 **CRITICAL:** Descrição objetiva do problema que inviabiliza o merge ou gera bug real. _(Score: 9/10)_

  Análise: 
  1. Evidência: ...
  2. Cenário de Falha: ...
  3. Proteção Ausente: ...
  4. Descartes: ...
  
  Caminhos analisados: `/caminho/do/arquivo.ext`, `/caminho/do/teste.ext`
  Ocorrências da mesma classe: `NomeDoArquivo.ext:L42`, `OutroArquivo.ext:L88`

  Sugestão:
  ```suggestion
  // Código corrigido com indentação correta
  ```

### ⚠️ Avisos e Riscos Potenciais (`warning`)
- **[NomeDoArquivo.ext:L80](file:///absolute/path/to/NomeDoArquivo.ext#L80)**: ⚠️ **WARNING:** Validação frágil ou risco de regressão sob cenários específicos. _(Score: 7/10)_

  Análise: ...
  Caminhos analisados: ...

  Sugestão:
  ```suggestion
  // Código sugerido
  ```

### 💡 Clean Code e Recomendações (`suggestion`)
- **[NomeDoArquivo.ext:L150](file:///absolute/path/to/NomeDoArquivo.ext#L150)**: 💡 **SUGGESTION:** Melhoria com impacto material comprovado. _(Score: 6/10)_

---
**Deseja que eu faça as correções e execute os testes locais?** *(Responda SIM para eu aplicar os ajustes sugeridos e rodar os comandos de build e teste do projeto).*
```

---

## 🔄 Fluxo de Correção Automática

Se o usuário responder **SIM**, o agente deve:
1. Aplicar cirurgicamente as correções aprovadas no código.
2. Identificar e rodar os comandos de compilação e teste do ecossistema do projeto (ex: `dotnet test` e `dotnet build`, `npm run test` e `npm run build`, `pytest`, etc.).
3. Apresentar o resumo das execuções de validação locais ao usuário.
