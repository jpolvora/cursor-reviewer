export interface ReviewSummarySanitizeOptions {
  pullRequestId: number;
  /** Título real da PR (API) — usado para reescrever cabeçalhos errados. */
  prTitle?: string;
  /** IDs de Work Items linkados — `#N` desses IDs não deve parecer referência à PR. */
  workItemIds?: number[];
  /** Títulos de WIs — se o agente colar o título da US/Task no lugar do da PR, corrige. */
  workItemTitles?: string[];
  /** ADO sanitiza `#N`; GitHub preserva autolinks de issues/PRs. */
  platform?: 'ado' | 'github';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Azure DevOps auto-linka `#123` como **Work Item** 123 (ícone 📖), não como Pull Request.
 * Esta função evita esse falso positivo no `reviewSummary` publicado e corrige
 * título de WI colado no lugar do título da PR.
 */
export function sanitizeReviewSummaryForPlatform(
  summaryText: string,
  options: ReviewSummarySanitizeOptions,
): string {
  const trimmed = summaryText.trim();
  if (!trimmed) {
    return '';
  }

  if (options.platform === 'github') {
    return trimmed;
  }

  const prId = options.pullRequestId;
  const prTitle = options.prTitle?.trim() ?? '';
  const workItemIds = [...new Set((options.workItemIds ?? []).filter((id) => id > 0 && id !== prId))];
  const workItemTitles = [...new Set((options.workItemTitles ?? []).map((t) => t.trim()).filter(Boolean))];

  let text = trimmed;

  // 1) PR #694 / #694 (ID da PR) → "PR 694" (sem #, para o ADO não linkar como WI)
  if (prId > 0) {
    text = text.replace(new RegExp(`\\bPR\\s*#\\s*${prId}\\b`, 'gi'), `PR ${prId}`);
    text = text.replace(new RegExp(`(^|[^\\w/])#${prId}\\b`, 'g'), `$1PR ${prId}`);
  }

  // 2) #2418 (WI conhecido) → "Work Item 2418"
  for (const wiId of workItemIds) {
    text = text.replace(
      new RegExp(`\\b(?:WI|Work\\s*Item|User\\s*Story|Task|Bug)\\s*#\\s*${wiId}\\b`, 'gi'),
      `Work Item ${wiId}`,
    );
    text = text.replace(new RegExp(`(^|[^\\w/])#${wiId}\\b`, 'g'), `$1Work Item ${wiId}`);
  }

  // 3) Qualquer `#N` restante ainda seria WI no ADO — neutraliza
  text = text.replace(/(^|[^\w/])#(\d+)\b/g, '$1Work Item $2');

  // 4) Normaliza "PR PR 694" se a substituição empilhou
  text = text.replace(/\bPR\s+PR\s+(\d+)\b/gi, 'PR $1');

  // 5) Se o resumo cola o título de um WI logo após "PR N", troca pelo título real da PR
  if (prId > 0 && prTitle) {
    for (const wiTitle of workItemTitles) {
      if (!wiTitle || wiTitle === prTitle) {
        continue;
      }
      const afterPrTitle = new RegExp(
        `(PR\\s+${prId}\\b)\\s*([«"']?)${escapeRegExp(wiTitle)}\\2`,
        'i',
      );
      if (afterPrTitle.test(text)) {
        text = text.replace(afterPrTitle, `$1 ("${prTitle}")`);
      }
    }

    // Cabeçalho típico sem o título da PR: reescreve a abertura
    const startsWithPrRef = new RegExp(`^Revisão[^\\n]*\\bPR\\s+${prId}\\b`, 'i');
    if (startsWithPrRef.test(text) && !text.includes(prTitle)) {
      text = text.replace(
        startsWithPrRef,
        `Revisão somente leitura da PR ${prId} ("${prTitle}")`,
      );
    }
  }

  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
