import type { CodeReviewItem, GateEvaluation, PendingPrThread, ReviewSeverity } from './types.js';
import { type TokenUsageTotals } from '../agent/token-usage.js';
export declare function countSeverities(reviews: CodeReviewItem[]): Record<ReviewSeverity, number>;
/** pendingThreads: apenas threads bot [Cursor Reviewer] active/pending (filtradas upstream). */
export declare function evaluateGate(params: {
    newReviews: CodeReviewItem[];
    resolvedCount: number;
    pendingThreads: PendingPrThread[];
}): GateEvaluation;
export declare function formatGateSummary(gate: GateEvaluation, agentId: string, runId: string, dryRun: boolean, tokenUsage?: TokenUsageTotals): string;
//# sourceMappingURL=gate.d.ts.map