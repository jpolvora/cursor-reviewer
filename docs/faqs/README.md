# FAQ e Documentação do Site

Esta pasta contém links rápidos e documentação sobre o site de catálogo de skills do `cursor-reviewer`.

## Referências Rápidas

*   **[Perguntas Frequentes (FAQ)](../faq.md):** Dúvidas comuns de funcionamento, score e fluxo técnico.
*   **[Página Inicial do Site](../index.html):** Código-fonte da página estática hospedada no GitHub Pages.

## Como Atualizar o Catálogo de Skills do Site

O site possui um catálogo dinâmico de skills locais que lê a pasta `.agents/skills/`. Toda vez que uma skill for adicionada ou atualizada:

1. Execute o script de build na raiz do projeto:
   ```bash
   node scripts/build-site.js
   ```
2. O script irá atualizar o arquivo `docs/index.html` com os novos metadados e contadores de skills do catálogo.

## Automatização de Deploy (GitHub Actions)

O deploy é feito automaticamente na branch `main` através do workflow do GitHub Actions em [.github/workflows/deploy-site.yml](../../.github/workflows/deploy-site.yml).
