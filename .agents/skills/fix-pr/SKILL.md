---
name: fix-pr
description: Analisa criticamente threads de code review em PRs do Azure DevOps, decide se cada comentário faz sentido e corrige apenas o necessário via commit/push cirúrgico. Adaptável à stack do repositório.
---

# fix-pr

## Objetivo

Atuar como **Senior Developer Specialist** para tratar threads ativas de code review em Pull Requests do Azure DevOps. Não aceite todo comentário cegamente: avalie profundamente se cada thread faz sentido técnico, se é coerente com a User Story (US) ou o plano de implementação e se a correção proposta é proporcional e justificada.

## Dependências permitidas

Esta skill deve ser autocontida. Use apenas:
- Helper Python local: `.agents/skills/fix-pr/scripts/fix_pr_azure_context.py` (interage com a API do Azure DevOps de forma nativa e sem dependências externas)
- Roteamento e regras de agentes locais do repositório: `AGENTS.md`
- Cursor rules do projeto: `.cursor/rules/main.mdc` (ou regras locais de agente equivalentes)
- **Skill de code review do projeto (dependência interna):** `.agents/skills/code-review/SKILL.md`. É a **fonte de verdade dos critérios** de qualidade de código (brechas, checklist, gate de severidade) e a ferramenta da **auto-revisão local antes do push** (Etapa 6).

*Restrição:* Não crie chamadas REST inline, curl, Invoke-RestMethod ou scripts adicionais de acesso ao Azure DevOps. A auto-revisão antes do push usa **exclusivamente** a skill interna `code-review`. Não invoque outras skills externas.

## Gatilho

Use quando o usuário pedir para corrigir, revisar, simular ou resolver comentários/threads de uma PR.
Exemplos: 
- *"Use fix-pr para corrigir os comentários da PR 459"*
- *"Use fix-pr em dry-run na PR 459"*

## Diretório de execução

Todos os artefatos temporários devem ficar no diretório da rodada (não comitar):
- Pasta por rodada: `.agents/skills/fix-pr/runs/pr-XXX/`
- Arquivos: `context.json`, `plan-gate.md`, `plan-exec.md`, `thread-YYYY.state.md`

Artefato **commitável** (gerado ao final):
- Report da rodada: `.cursor/codereviews/PR-XXX-rodada-N.md`

---

## Fluxo Obrigatório

### 0. Coleta e Resolução no Azure DevOps (Obrigatório)

Execute a partir da raiz do workspace:
```bash
# Coletar contexto da PR
python .agents/skills/fix-pr/scripts/fix_pr_azure_context.py collect --pr-id XXX --output .agents/skills/fix-pr/runs/pr-XXX/context.json

# Resolver thread (normal)
python .agents/skills/fix-pr/scripts/fix_pr_azure_context.py resolve-thread --pr-id XXX --thread-id YYYY --comment "Justificativa..."

# Resolver thread (dry-run)
python .agents/skills/fix-pr/scripts/fix_pr_azure_context.py resolve-thread --dry-run --pr-id XXX --thread-id YYYY --comment "Justificativa..."
```
Se a coleta de contexto falhar, pare e reporte imediatamente. Não improvise acessos à API.

### 1. Montar Contexto Real

1. Autodetecte o ecossistema tecnológico do projeto na raiz (verifique se há arquivos `.csproj`, `package.json`, `go.mod`, `requirements.txt`, etc.).
2. Leia o arquivo `context.json` gerado na Etapa 0 e reúna: comentário original, arquivo/linha afetada, descrição e critérios de aceitação (ACs) do Work Item vinculado, planos de implementação locais (`.cursor/plans/`), trecho do código atual do arquivo e regras de agente aplicáveis do repositório.

### 2. Julgar Cada Thread Ativa

Avalie cada thread técnica sob os seguintes critérios:
1. O cenário de falha apontado é executável e provável de ocorrer?
2. Há coerência do apontamento com o escopo do Work Item e o plano aprovado?
3. O código atual já se protege contra isso por meio de outras invariantes, validações ou testes?
4. O impacto potencial é material (segurança, perda/vazamento de dados, brechas financeiras/fiscais)?
5. A alteração recomendada é proporcional ou configura overengineering/nit de estilo pessoal?

Calibre a urgência/criticidade (score de 0 a 10) e classifique a ação:

| Score | Urgência | Significado / Ação Recomendada |
|---|---|---|
| **0–2** | Nível Baixo | Nit estético, estilo, preferências de escrita de código. $\rightarrow$ **Resolver sem código** |
| **3–5** | Nível Baixo | Risco material baixo ou inconsistência improvável. $\rightarrow$ **Resolver sem código** |
| **6–8** | Alta | Bug provável, falha lógica ou desalinhamento com critérios do Work Item. $\rightarrow$ **Corrigir em código** |
| **9–10** | Alta | Crítico (segurança, perda de dados, integridade transacional). $\rightarrow$ **Corrigir em código** |

*Nota:* Se houver conflito de regras entre o Work Item, o plano e o comentário, ou se houver uma ambiguidade de produto que exija decisão humana, classifique como **Escalar**.

### 3. Gate de Confirmação do Usuário (Obrigatório)

Antes de qualquer edição de código ou execução de `resolve-thread`, apresente o plano ao usuário e **pare** para confirmação.
Grave o plano temporário em `.agents/skills/fix-pr/runs/pr-XXX/plan-gate.md` (não comitar) dividido em:
- **Corrigir em código** (Threads com Score > 5)
- **Resolver com comentário (sem alterar código)** (Threads com Score $\le$ 5)
- **Escalar** (Aguardar decisão humana)

*Estrutura da tabela:* `Thread` | `Arquivo` | `Score` | `Urgência` | `Justificativa resumida`.

Apresente o resumo numérico e pergunte **exatamente**:
```text
Deseja efetuar as correções ou finalização das threads [ID1, ID2]?
```
- Se o usuário recusar ou não confirmar, não prossiga. Se solicitado limpeza, apague recursivamente a pasta temporária `runs/pr-XXX/` (preservando o `.gitignore`).
- Se pedir alteração de classificação, atualize o arquivo do plano e refaça a pergunta.

### 3.1. Plano de Execução (Pós-Gate)

Após confirmação do gate 3:
1. Crie `.agents/skills/fix-pr/runs/pr-XXX/plan-exec.md` detalhando as tarefas de execução. O cabeçalho deve conter:
   - Metadata básica (PR, Rodada, Gate Aprovado em, Modo, Contexto).
   - Detalhamento por thread aprovada: `ThreadId`, `Ação`, `Arquivo/linha`, `Estratégia`, `Arquivos permitidos`, `Subagent` (indicação de uso e prompt do subagent), `Testes` e `Checklist`.
   - Seção **Report commitável** prevendo o layout final (conforme Etapa 6).
   - Checklist operacional de publicação (Etapas 4–6).
2. Informe o caminho de `plan-exec.md` e pergunte **exatamente**:
```text
Deseja executar o plano normalmente?
```
3. Execute as etapas 4–6 apenas se o plano for explicitamente aprovado.

### 4. Resolver Sem Código (Urgência Score $\le$ 5)

Para threads classificadas como `Resolver com comentário`, poste a justificativa via helper:
```bash
python .agents/skills/fix-pr/scripts/fix_pr_azure_context.py resolve-thread --pr-id XXX --thread-id YYYY --comment "Sem alteração de código: o cenário citado já é bloqueado por X; o Work Item/plano não exige Y; risco real baixo por Z."
```
(Adicione o argumento `--dry-run` caso o modo dry-run esteja ativo).

### 5. Corrigir Código (Urgência Score > 5)

Para cada thread aprovada para correção em código:
1. Mapeie a estratégia de correção contra a thread de review e os critérios de qualidade descritos em `.agents/skills/code-review/SKILL.md`.
2. Analise os impactos locais: chamadores, assinaturas, testes e fluxos adjacentes.
3. **Corrija a classe do defeito, não apenas a instância (Obrigatório).** Antes de fechar a thread, busque por ocorrências irmãs do mesmo padrão ou brecha nos arquivos alterados do diff. Corrija todas de uma só vez para evitar loops em revisões seguintes.
4. Crie `.agents/skills/fix-pr/runs/pr-XXX/thread-YYYY.state.md` contendo: problema, estratégia, ocorrências irmãs encontradas, caminhos analisados, riscos residuais e plano de testes.
5. Execute via subagent para isolar e validar a alteração.

### 6. Validar, Reportar, Fechar Threads e Publicar

1. Execute os comandos de compilação (build) e de testes automatizados do ecossistema do projeto (ex: `dotnet test` e `dotnet build`, `npm run test` e `npm run build`, `pytest`, etc.).
2. **Auto-revisão local antes do push (Obrigatório).** Execute a skill interna **`code-review`** (`.agents/skills/code-review/SKILL.md`) sobre o diff atual da sua branch para verificar suas próprias alterações sob o mesmo rigor da pipeline.
   - Use-a apenas para **detecção**. As correções continuam sendo aplicadas pelo fluxo de correção.
   - Corrija novos achados apontados pela auto-revisão e repita o processo até obter o status **"Sem feedback"**.
3. Se houver alterações de código, gere o relatório commitável `.cursor/codereviews/PR-XXX-rodada-N.md` contendo:
   - **Resumo**: PR, rodada, threads tratadas, testes locais executados, arquivos alterados.
   - **Por thread corrigida**: problema, o que foi feito, como foi corrigido, caminhos analisados, testes escritos e riscos residuais.
   - **Por thread sem código**: justificativa clara por que não houve mudança.
4. Resolva cada thread no Azure DevOps via helper, comentando de forma explicativa (referenciando o arquivo do relatório).
5. Faça o commit e stage cirúrgicos (nunca utilize `git add .` indiscriminadamente):
   - Inclua os arquivos modificados e o relatório `.cursor/codereviews/PR-XXX-rodada-N.md`.
   - Mensagem de commit obrigatória: `Fix PR XXX: thread(s): [thread1, thread2] (rodada N)`.
   - Faça `git push` (a menos que esteja rodando em modo `dry-run`).

---

## Resposta Final Obrigatória

Seu report final para o usuário no chat deve conter:
1. Resumo das threads tratadas e a ação tomada (Corrigida, Resolvida ou Escalada).
2. Justificativa curta por decisão, impacto avaliado e testes locais executados.
3. Link/caminho do relatório `.cursor/codereviews/PR-XXX-rodada-N.md` criado no repositório.
4. Lista de arquivos alterados e commitados.
5. Hash e mensagem do commit, e confirmação do push (ou indicação de simulação em `dry-run`).
