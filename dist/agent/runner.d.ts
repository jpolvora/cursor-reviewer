import type { ReviewerConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { type PromptContext } from './prompt.js';
import { type AgentRunResult } from './stream.js';
export type { AgentRunResult };
export declare function runCodeReviewAgent(config: ReviewerConfig, context: PromptContext, logger: Logger): Promise<AgentRunResult>;
//# sourceMappingURL=runner.d.ts.map