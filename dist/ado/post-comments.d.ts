import { AdoClient } from './client.js';
import { isPublishableReview } from './review-validation.js';
import type { ActiveThreadInfo, AdoThreadsResponse, CodeReviewItem, CodeReviewResponse, ParsedCodeReviewResponse, PendingPrThread, PostedReviewThread, PostingPlan, ResolvedThreadItem } from './types.js';
export declare function parseCodeReviewResponse(raw: CodeReviewResponse, scoreMin?: number): ParsedCodeReviewResponse;
export { isPublishableReview };
export declare function getCodeReviewPostingPlan(parsed: ParsedCodeReviewResponse, hasExternalPendingThreads: boolean): PostingPlan;
export declare function isDuplicateReview(review: CodeReviewItem, existingKeys: Map<string, boolean>): boolean;
export declare function matchesResolvedItem(threadInfo: ActiveThreadInfo, item: ResolvedThreadItem): boolean;
export declare function filterValidResolvedItems(resolvedItems: ResolvedThreadItem[]): ResolvedThreadItem[];
export declare function isActiveOrPendingStatus(status: string): boolean;
/** Espelha a lógica de `resolvePullRequestReviewThreads` sem chamadas ADO (dry-run). */
export declare function simulateThreadResolution(activeThreads: ActiveThreadInfo[], pendingThreads: PendingPrThread[], resolvedItems: ResolvedThreadItem[]): {
    resolvedCount: number;
    pendingThreads: PendingPrThread[];
};
/** Resolve apenas threads confirmadas pelo agente em `resolvedThreads`. */
export declare function resolvePullRequestReviewThreads(client: AdoClient, pullRequestId: number, botTag: string, activeThreads: ActiveThreadInfo[], resolvedItems: ResolvedThreadItem[], log: (msg: string) => void): Promise<number>;
export declare function setPullRequestReviewSummary(client: AdoClient, pullRequestId: number, botTag: string, summaryText: string, allThreads: AdoThreadsResponse | null, log: (msg: string) => void, prTitle?: string, workItems?: Array<{
    id: number;
    title: string;
}>): Promise<boolean>;
export declare function setPullRequestComments(client: AdoClient, pullRequestId: number, botTag: string, reviewsJson: string, existingKeys: Map<string, boolean>, log: (msg: string) => void, scoreMin?: number): Promise<PostedReviewThread[]>;
export declare function getNewReviewsFromPlan(reviewsJson: string, existingKeys: Map<string, boolean>, scoreMin?: number): CodeReviewItem[];
//# sourceMappingURL=post-comments.d.ts.map