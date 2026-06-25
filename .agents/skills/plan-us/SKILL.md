---
name: plan-us
description: Elabora plano detalhado para implementar User Story do Azure DevOps no projeto. Identifica dinamicamente a stack (ex: ABP/.NET/Angular, Node/React, etc.) e adapta as camadas e regras de arquitetura.
version: 2.0
---

# Plan User Story Skill

Esta skill orquestra a elaboração de um **plano de implementação detalhado e passo a passo** para uma User Story do Azure DevOps, garantindo aderência absoluta aos padrões de arquitetura do repositório em execução, boas práticas de clean code, segurança (OWASP), testes automatizados e regras de negócio locais.

Atue como **Software Architect e Senior Developer Specialist**, adaptando-se dinamicamente ao ecossistema do repositório detectado e gerando blueprints prontos para codificação.

---

## Instruções de Uso

Quando o usuário acionar esta skill passando o número de uma US (ex.: `@[/plan-us] 1234`), execute **em ordem** o fluxo abaixo, substituindo `XXXX` pelo número da US.

> Se o número da US não for informado, **pare e pergunte** antes de continuar.

---

## Fluxo de Execução

### 0. Reconhecimento de Stack e Ecossistema (Fase Prévia)
Antes de elaborar o plano, execute uma varredura rápida na raiz do repositório para determinar o ecossistema tecnológico do projeto:
- **ABP Framework (.NET + Angular):** Presença de arquivos `.csproj` (com referências ABP), `.sln`, `angular.json` e estrutura DDD clássica.
- **Node.js (Backend) + React/Next.js/Angular (Frontend):** Presença de `package.json`, `tsconfig.json` e pastas separadas para client/server.
- **Python (Django/FastAPI) / Go / Java:** Presença de arquivos estruturais dessas linguagens.

### 1. Recuperar e Analisar a US (via Azure DevOps)
- Acione o helper do Azure DevOps (`get-wi-with-children.ps1` ou correspondente) ou leia o snapshot local para carregar os detalhes da US `XXXX` (descrição, critérios de aceite (ACs), comentários, links, anexos).
- **Regras de Negócio e Domínio:** Mapeie todas as regras explícitas e implícitas e verifique se há documentação crítica de regras de negócio na pasta `docs/` do repositório atual para cruzar e evitar violações.

### 2. Carregar Contexto e Regras Locais
Leia os guias de desenvolvimento e restrições técnicas do repositório:
- `AGENTS.md` na raiz do projeto.
- O índice de regras em `.cursor/rules/` (ou diretório equivalente do IDE/agente local).
- O arquivo global de boas práticas / postura (geralmente `senior-developer.mdc` ou equivalente em `.cursor/rules/`).

### 3. Buscar Exemplos Equivalentes no Repositório
Antes de propor novas estruturas de arquivos, classes ou funções, **procure componentes/telas/recursos similares já implementados** no projeto e siga exatamente o mesmo padrão arquitetural.

### 4. Produzir o Plano Detalhado (Formato de Saída)
Gere um documento estruturado (Markdown). Ele servirá de **roteiro passo a passo** para o desenvolvedor ou agente implementar a feature. Estruture a resposta exatamente nas seções detalhadas abaixo, adaptando-as conforme a stack tecnológica detectada.

---

## Formato do Plano de Implementação

### 0. Resumo e Análise de Regras de Negócio
- Título da US, número e objetivo.
- **Regras de Negócio Analisadas**: Resumo das regras mapeadas e o comportamento esperado.
- **Análise de Segurança**: Potenciais riscos (ex: injeção de SQL, vazamento de dados cross-tenant, falta de autorização, exposição de secrets) e as mitigações exigidas usando recursos nativos do ecossistema.

### 1. Definition of Ready (DoR) e Escopo
- Ambiguidades resolvidas (se houver dúvidas impeditivas, liste-as e **PARE**).
- Critérios de Aceite (ACs) mensuráveis e testáveis.
- Delimitação clara: O que **ENTRA** e o que **NÃO ENTRA** no escopo desta implementação.

### 2. Design Técnico e Arquitetura

Descreva as decisões estruturais e liste os **arquivos exatos a serem criados/alterados**, organizados por camada de acordo com a stack detectada:

#### [Caso ABP Framework / .NET + Angular]
- **Domain.Shared**: Constantes, Enums, Chaves de Localização, ETOs.
- **Domain**: Entidades, Agregados, Domain Services (`*Manager`), regras puras.
- **Application.Contracts**: DTOs, Interfaces `I*AppService`, Definição de Permissões.
- **Application**: Implementações de `*AppService`, mapeadores, validações (DataAnnotations/FluentValidation), autorização.
- **EntityFrameworkCore**: Mapeamento fluente, DbSet, Repositórios customizados, Migrations.
- **Angular**: Componentes UI, Serviços proxy, Rotas, Guards, Formulários, validações.

#### [Caso Node.js (NestJS/Express) + React/Next.js]
- **Database / ORM**: Migrations de banco de dados, entidades/modelos (Prisma, TypeORM, Mongoose).
- **Backend Core**: Services, Controllers/Resolvers, DTOs, Schemas de validação (Zod, Yup), Middlewares (Auth, Roles).
- **Frontend Core**: Componentes de UI, hooks, roteamento, chamadas de API client, gerenciamento de estado local.

#### [Outras Stacks]
- Organize as camadas lógicas de acordo com o padrão arquitetural predominante no repositório (ex: MVC, Clean Architecture, Ports and Adapters).

### 3. Plano de Implementação Passo a Passo (O Core da Skill)
Instruções sequenciais e detalhadas de implementação. Para CADA PASSO, defina:
- **Ação:** O que fazer e como implementar tecnicamente.
- **Arquivos:** Caminho completo dos arquivos a serem criados ou modificados.
- **Boas Práticas & Guardrails:** Quais diretrizes arquiteturais locais aplicar rigorosamente (ex: injeção de dependência adequada, tratamento de erros, uso de timestamps universais).
- **Segurança:** Onde aplicar validações de payloads de entrada e declarações de autorização (permissões/roles).

**Estrutura de Agrupamento Recomendada:**
- **Passo 1: Camada de Domínio / Banco de Dados** (Entidades, modelos, migrations, mapeamentos)
- **Passo 2: Camada de Aplicação / Negócio** (Services, Controllers, DTOs, mapeadores, validações e autorização)
- **Passo 3: Testes do Backend** (Cobertura dos ACs com testes unitários e de integração no backend)
- **Passo 4: Camada de Frontend / UI** (Componentes visuais, rotas, chamadas de API client, formulários e validações de UI)
- **Passo 5: Testes do Frontend** (Se aplicável)

### 4. Permissões, Multi-Tenancy e Localização
- Defina explicitamente as **novas permissões** necessárias (create, read, update, delete) e onde registrá-las.
- Se aplicável no repositório, confirme o suporte a **Multi-Tenancy** (isolamento de inquilinos).
- Liste as **chaves de localização (i18n)** e os arquivos de tradução correspondentes que devem ser atualizados.

### 5. Cobertura de Testes (Baseado nos ACs)
- Mapeie **CADA Critério de Aceite (AC) para casos de teste** específicos.
- Defina nomes de métodos de teste descritivos e claros.
- Especifique quais frameworks de asserção e mocks de dependências utilizar.

### 6. Restrições Técnicas Cruciais (Não Violar)
- Liste ações proibidas ou de geração automática no ecossistema (ex: proxies Angular autogerados que não devem ser editados manualmente, migrations de banco que devem ser geradas via CLI, isolamento estrito de camadas).

### 7. Checklist Pré-PR (Definition of Done)
- [ ] Código obedece à separação de camadas definida.
- [ ] Entidades de domínio encapsuladas com validações de invariantes de negócio.
- [ ] Migrations de banco de dados aplicadas localmente com sucesso.
- [ ] Permissões de segurança aplicadas em todos os novos endpoints e telas.
- [ ] Proxies de client e modelos de API atualizados.
- [ ] Testes de unidade/integração escritos e cobrindo os critérios de aceite (passando com sucesso).
- [ ] Sem quebras de layout ou erros de console no frontend.

### 8. Perguntas em Aberto
- Dúvidas, ambiguidades, dependências externas pendentes ou regras de negócio que precisam de clarificação do usuário **antes** do início do desenvolvimento.

---

## Regras de Conduta da Skill
- **Seja Exhaustivo:** O plano deve ser detalhado ao ponto de um desenvolvedor conseguir implementar as tarefas apenas seguindo o guia sequencial.
- **Não Codifique a Feature:** O objetivo desta skill é GERAR O PLANO (blueprint). Não implemente as classes finais do código-fonte ou crie arquivos de produção. Entregue o plano (como um artifact markdown estruturado) e aguarde o feedback do usuário.
