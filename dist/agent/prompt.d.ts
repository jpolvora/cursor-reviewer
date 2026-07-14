import type { ReviewerConfig } from '../config.js';
import type { DiffPromptSection } from '../git/diff-prompt.js';
import type { LocalReviewGitContext } from '../git/diff.js';
export interface PromptContext {
    workItemContext: string;
    prDescriptionContext: string;
    existingReviewContext: string;
    rulesContext: string;
    diffSection: DiffPromptSection;
    diffStats: {
        fileCount: number;
        files: string[];
    };
    gitContext: LocalReviewGitContext;
}
export declare function buildAgentPrompt(config: ReviewerConfig, context: PromptContext): string;
//# sourceMappingURL=prompt.d.ts.map