import { AdoClient } from './client.js';
import type { AdoThreadsResponse, PendingPrThread, ReviewContextResult } from './types.js';
export declare function getReviewSummaryFromComment(content: string, botTag: string): string;
export declare function filterGatePendingThreads(threads: PendingPrThread[], botTag: string): PendingPrThread[];
export declare function getPullRequestReviewContext(client: AdoClient, pullRequestId: number, botTag: string, log: (msg: string) => void): Promise<ReviewContextResult>;
export declare function testReviewSummaryAlreadyPosted(threads: AdoThreadsResponse | null, botTag: string, summaryText: string): boolean;
//# sourceMappingURL=review-context.d.ts.map