# Cursor Reviewer — Instruções e Referência para Agentes

Este arquivo serve como guia de referência técnico e operacional para agentes de IA que operam neste repositório, seja atuando como **analisador de PRs** (executando o review) ou como **desenvolvedor do próprio runner** (realizando correções e implementando melhorias).

---

## 1. Escopo e Modo de Operação (Somente Leitura)

O `cursor-reviewer` é uma ferramenta agêntica de Code Review automatizado executada via `@cursor/sdk`. O runner atua estritamente em **modo de leitura (review-only)**, mapeando issues e publicando-as na PR sem alterar arquivos do repositório alvo.

### 🛑 Diretrizes de Segurança (Sandbox)
*   **Sandbox Ativo:** O SDK é executado com a opção `local.sandboxOptions.enabled` ativada em `src/agent/stream.ts`.
*   **Proibições Estritas:** É proibido realizar commits, push, alterar o histórico Git (além de diffs/logs simples), aplicar correções automáticas no código analisado, rodar formatters/linters ou modificar arquivos no repositório sob revisão.
*   **Permissões:** É permitido ler arquivos e diretórios (`read`, `grep`, `glob`, busca semântica), inspecionar diffs e declarar correções sugeridas nos campos JSON de saída.

---

## 2. Para Agentes Analisadores (Executando o Code Review)

Quando você for invocado pelo runner para analisar uma PR, você deve seguir estritamente o processo abaixo.

### 2.1 Análise em Duas Fases
1.  **Fase 1: Triagem (Mapa de Candidatos):**
    *   Examine o diff git pré-carregado no prompt ou use `git diff` nos arquivos alterados.
    *   Identifique linhas alteradas que contenham potenciais falhas reais (segurança, concorrência, vazamento de recursos, bugs lógicos).
    *   **Descarte imediatamente:** "nits", questões de estilo/formatação, preferências pessoais de escrita de código ou alertas meramente conceituais sem um caminho plausível de execução falha.
2.  **Fase 2: Investigação Profunda e Validação:**
    *   Para cada candidato pré-selecionado, use tools (`read_file`, `grep_search`) para ler o arquivo inteiro, símbolos relacionados e arquivos adjacentes (ex: testes unitários, entidades, chamadores, middlewares).
    *   Formule e documente no campo `analysis` do JSON a prova estruturada:
        1.  **Evidência lida** (símbolos e arquivos investigados).
        2.  **Cenário de falha executável** (como o bug ocorre na prática).
        3.  **Proteção ausente** (por que testes/validações atuais não bloqueiam a falha).
        4.  **Descartes** (hipóteses alternativas que foram testadas e rejeitadas).
    *   Se não conseguir preencher as 4 etapas com provas coletadas via tools, **descarte** o achado.

### 2.2 Consulta ao Harness do Projeto Alvo
Os critérios e checklists específicos de negócio residem no repositório analisado (`repoRoot`). Consulte sempre nesta ordem (se existirem):
1.  `AGENTS.md` do projeto alvo.
2.  `.cursor/rules/main.mdc` (Índice de regras) ou as regras pré-mapeadas enviadas pelo prompt.
3.  `.agents/skills/code-review/SKILL.md` (Checklist de auditoria).
4.  Subpasta `docs/` para regras de domínio/arquitetura.

### 2.3 Contrato de Saída JSON
Sua resposta deve conter **exclusivamente** um único bloco markdown JSON contendo as chaves `reviews`, `resolvedThreads` e `reviewSummary`.

```json
{
  "reviews": [
    {
      "fileName": "/src/MinhaClasse.cs",
      "lineNumber": 15,
      "severity": "critical",
      "comment": "Descrição curta e amigável da falha (sem blocos de código).",
      "score": 9,
      "developerAction": "fix-code",
      "analysis": "1. Evidência: ... 2. Cenário: ... 3. Proteção: ... 4. Descarte: ...",
      "impactPaths": ["/src/MinhaClasse.cs", "/src/Middlewares/Auth.cs"],
      "suggestedFix": "```csharp\n// Correção cirúrgica clara\n```"
    }
  ],
  "resolvedThreads": [
    {
      "threadId": 12345,
      "note": "Corrigido adicionando validação de nulo na linha 15."
    }
  ],
  "reviewSummary": ""
}
```

### 2.4 Validação do Gate de Publicação
Comentários que violarem os critérios abaixo serão descartados programaticamente por `src/ado/review-validation.ts`:

*   **`score`:** Deve ser um número inteiro finito entre **6 e 10**. Achados com score ≤ 5 serão descartados pelo gate.
*   **`fileName` & `lineNumber`:** Devem apontar para caminhos e linhas alteradas no diff (> 0).
*   **`severity`:** Apenas `critical` (score 9-10), `warning` (score 6-8) ou `suggestion` (score 6-7).
*   **`developerAction`:** Deve ser `fix-code` ou `escalate` (não utilize `resolve-comment` em novos reviews).
*   **`suggestedFix`:** Opcional. Use blocos de código específicos por linguagem. **Nunca** use a cerca ` ```suggestion ` se o provedor for Azure DevOps (o gate a normaliza, mas prefira omitir). Em GitHub, você pode usar a cerca ` ```suggestion ` para habilitar o botão de aplicação automática.
*   **`analysis`:** Deve detalhar os 4 passos da prova estruturada.
*   **`impactPaths`:** Array contendo obrigatoriamente ao menos um caminho de arquivo lido que sustente a investigação.

### 2.5 Mecanismo de Rodadas e Escalonamento
O runner acompanha as iterações na PR pelo marcador `<!-- reviewer-round-state -->`. Se a rodada atual exceder `CURSOR_REVIEWER_MAX_ROUNDS` (default: 5):
*   Você deve suprimir e omitir novos achados de severidade `warning` e `suggestion`.
*   Apenas achados `critical` (segurança ou quebra de invariantes críticos de negócio) continuam sendo publicados.
*   O runner adicionará um aviso na PR solicitando **handoff para revisão humana**.

### 2.6 Autoexclusão do Runner
Por padrão, o runner exclui a si mesmo do diff Git para evitar loops infinitos de autorevisão (a menos que a variável `CURSOR_REVIEWER_REVIEW_SELF` seja definida como `true`).

---

## 3. Para Agentes Desenvolvedores (Modificando o Codebase)

Se o seu objetivo é modificar ou estender a lógica deste repositório, atente-se às seguintes orientações.

### 3.1 Arquitetura do Runner
*   `src/index.ts` : Ponto de entrada. Prepara o workspace Git, inicializa o provedor correto, coleta o contexto de PR e Work Items, dispara a sessão agêntica via SDK, passa a resposta do agente pelo parser/gate e publica os comentários.
*   `src/config.ts` : Declara e valida argumentos CLI e variáveis de ambiente.
*   `src/provider/` : Contém a interface `PlatformProvider` e as implementações `AdoProvider` (Azure DevOps) e `GithubProvider` (GitHub).
*   `src/ado/` : Contém validadores (`review-validation.ts`), formatadores de comentário (`format-thread.ts`), controle de rodadas (`round-state.ts`) e o gate lógico (`gate.ts`).
*   `src/agent/` : Código de streaming do agente, modelagem e uso de tokens.
*   `skills/stacks/` : Contém os arquivos markdown de recomendações específicas para cada stack.

### 3.2 Execução de Testes e Validação
Antes de submeter alterações ou finalizar tarefas de desenvolvimento, você **deve** certificar-se de que os testes passam e que o workspace está higienizado:

1.  **Executar Typecheck e Testes Unitários:**
    ```bash
    npm test
    ```
2.  **Validação E2E com Agente (Seed Test):**
    Este comando instala fixtures simulando defeitos propositais (`angular` e `src`), roda o reviewer localmente com `--dry-run --seed-test` e verifica se os defeitos em `SEED-ISSUES.md` foram detectados:
    ```bash
    npm run test:seed
    ```
3.  **Higiene do Workspace:**
    Não commite arquivos temporários (como `.tmp-*`, logs temporários ou fixtures que permaneceram instaladas). Certifique-se de que as fixtures seed foram desinstaladas e execute a validação de limpeza:
    ```bash
    npm run seed:verify-clean
    ```

### 3.3 Boas Práticas
*   **Diferenças de Provedores:** Certifique-se de que qualquer nova feature funcione corretamente tanto no Azure DevOps quanto no GitHub. O tratamento de markdown, a API GraphQL/REST e o formato de sugestões interativas são sensivelmente distintos entre as duas plataformas.
*   **Compatibilidade de Stacks:** Ao adicionar ou modificar stacks, certifique-se de manter compatibilidade com o comportamento de fallback padrão (`ABP/Angular`) e valide que a estratégia de autodetecção funciona e é coberta por testes no `test/config.test.ts`.
*   **Sincronização de Docs:** Ao alterar o validador de gate (`review-validation.ts`), o controle de rodadas (`round-state.ts`), a lógica de diff, as stacks suportadas ou prompts do sistema, lembre-se de atualizar em conjunto este arquivo `AGENTS.md`, o `README.md` e as referências em `docs/`.

### 3.4 Gerenciamento e Atualização de Skills
*   **Sincronização com o Usuário:** Ao criar novas skills ou atualizar as existentes na pasta `.agents/skills`, os usuários devem ser capazes de sincronizá-las em seus repositórios locais executando o script `install-skills.sh`.
*   **Portabilidade do Script:** Sempre que modificar a estrutura de diretórios ou o script `install-skills.sh`, certifique-se de que o instalador continue funcionando de forma portável em sistemas operacionais e terminais diversos (Git Bash no Windows, WSL, Linux, macOS).

