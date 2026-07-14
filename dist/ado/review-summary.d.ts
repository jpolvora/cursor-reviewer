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
/**
 * Sanitiza `reviewSummary` conforme regras de autolink da plataforma.
 * - **ADO:** `#N` vira Work Item — reescreve PR/WI para texto sem hash falso-positivo.
 * - **GitHub:** `#N` é autolink válido — preserva issues/PRs e normaliza menções à PR atual.
 */
export declare function sanitizeReviewSummaryForPlatform(summaryText: string, options: ReviewSummarySanitizeOptions): string;
//# sourceMappingURL=review-summary.d.ts.map