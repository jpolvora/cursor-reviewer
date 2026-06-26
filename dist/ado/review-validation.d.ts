import type { CodeReviewItem } from './types.js';
export declare const MIN_PUBLISHABLE_SCORE = 6;
export declare const MAX_PUBLISHABLE_SCORE = 10;
/** Review elegível para publicação na PR (contrato prompt + gate programático). */
export declare function isPublishableReview(review: CodeReviewItem): boolean;
export declare function filterPublishableReviews(reviews: CodeReviewItem[]): CodeReviewItem[];
//# sourceMappingURL=review-validation.d.ts.map