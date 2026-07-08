export interface ReviewSummarySanitizeOptions {
  pullRequestId: number;
  /** Título real da PR (API) — usado para reescrever cabeçalhos errados. */
  prTitle?: string;
  /** IDs de Work Items linkados — `#N` desses IDs não deve parecer referência à PR. */
  workItemIds?: number[];
  /** Títulos de WIs — se o agente colar o título da US/Task no lugar do da PR, corrige. */
  workItemTitles?: string[];
  /** ADO neutraliza `#N`; GitHub preserva autolinks e normaliza menções à PR. */
  platform?: 'ado' | 'github';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeWhitespace(text: string): string {
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function correctMisplacedWorkItemTitles(
  text: string,
  prId: number,
  prTitle: string,
  workItemTitles: string[],
  formatPrRef: (id: number) => string,
): string {
  if (prId <= 0 || !prTitle) {
    return text;
  }

  const prRef = formatPrRef(prId);
  let result = text;

  for (const wiTitle of workItemTitles) {
    if (!wiTitle || wiTitle === prTitle) {
      continue;
    }
    const afterPrTitle = new RegExp(
      `(${escapeRegExp(prRef)})\\s*([«"']?)${escapeRegExp(wiTitle)}\\2`,
      'i',
    );
    if (afterPrTitle.test(result)) {
      result = result.replace(afterPrTitle, (_match, capturedPrRef) => `${capturedPrRef} ("${prTitle}")`);
    }
  }

  const startsWithPrRef = new RegExp(`^Revisão[^\\n]*\\b${escapeRegExp(prRef)}\\b`, 'i');
  if (startsWithPrRef.test(result) && !result.includes(prTitle)) {
    result = result.replace(
      startsWithPrRef,
      () => `Revisão somente leitura da ${prRef} ("${prTitle}")`,
    );
  }

  return result;
}

function sanitizeForAdo(text: string, options: ReviewSummarySanitizeOptions): string {
  const prId = options.pullRequestId;
  const prTitle = options.prTitle?.trim() ?? '';
  const workItemIds = [...new Set((options.workItemIds ?? []).filter((id) => id > 0 && id !== prId))];
  const workItemTitles = [...new Set((options.workItemTitles ?? []).map((t) => t.trim()).filter(Boolean))];

  let result = text;

  // 1) PR #694 / #694 (ID da PR) → "PR 694" (sem #, para o ADO não linkar como WI)
  if (prId > 0) {
    result = result.replace(new RegExp(`\\bPR\\s*#\\s*${prId}\\b`, 'gi'), `PR ${prId}`);
    result = result.replace(new RegExp(`(^|[^\\w/])#${prId}\\b`, 'g'), `$1PR ${prId}`);
  }

  // 2) #2418 (WI conhecido) → "Work Item 2418"
  for (const wiId of workItemIds) {
    result = result.replace(
      new RegExp(`\\b(?:WI|Work\\s*Item|User\\s*Story|Task|Bug)\\s*#\\s*${wiId}\\b`, 'gi'),
      `Work Item ${wiId}`,
    );
    result = result.replace(new RegExp(`(^|[^\\w/])#${wiId}\\b`, 'g'), `$1Work Item ${wiId}`);
  }

  // 3) Qualquer `#N` restante ainda seria WI no ADO — neutraliza
  result = result.replace(/(^|[^\w/])#(\d+)\b/g, '$1Work Item $2');

  // 4) Normaliza "PR PR 694" se a substituição empilhou
  result = result.replace(/\bPR\s+PR\s+(\d+)\b/gi, 'PR $1');

  // 5) Corrige título de WI colado no lugar do título da PR
  result = correctMisplacedWorkItemTitles(result, prId, prTitle, workItemTitles, (id) => `PR ${id}`);

  return normalizeWhitespace(result);
}

function sanitizeForGithub(text: string, options: ReviewSummarySanitizeOptions): string {
  const prId = options.pullRequestId;
  const prTitle = options.prTitle?.trim() ?? '';
  const workItemTitles = [...new Set((options.workItemTitles ?? []).map((t) => t.trim()).filter(Boolean))];

  let result = text;

  // Normaliza "PR 18" / "PR #18" → "#18" para autolink GitHub
  if (prId > 0) {
    result = result.replace(new RegExp(`\\bPR\\s*#\\s*${prId}\\b`, 'gi'), `#${prId}`);
    result = result.replace(new RegExp(`\\bPR\\s+${prId}\\b`, 'gi'), `#${prId}`);
  }

  // Corrige título de WI colado; mantém formato #N para links
  result = correctMisplacedWorkItemTitles(result, prId, prTitle, workItemTitles, (id) => `#${id}`);

  return normalizeWhitespace(result);
}

/**
 * Sanitiza `reviewSummary` conforme regras de autolink da plataforma.
 * - **ADO:** `#N` vira Work Item — reescreve PR/WI para texto sem hash falso-positivo.
 * - **GitHub:** `#N` é autolink válido — preserva issues/PRs e normaliza menções à PR atual.
 */
export function sanitizeReviewSummaryForPlatform(
  summaryText: string,
  options: ReviewSummarySanitizeOptions,
): string {
  const trimmed = summaryText.trim();
  if (!trimmed) {
    return '';
  }

  const platform = options.platform ?? 'ado';
  if (platform === 'github') {
    return sanitizeForGithub(trimmed, options);
  }

  return sanitizeForAdo(trimmed, options);
}
