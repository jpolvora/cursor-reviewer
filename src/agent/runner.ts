import type { ReviewerConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { buildAgentPrompt, type PromptContext } from './prompt.js';
import { runAgentStream, type AgentRunResult } from './stream.js';

export type { AgentRunResult };

export async function runCodeReviewAgent(
  config: ReviewerConfig,
  context: PromptContext,
  logger: Logger,
): Promise<AgentRunResult> {
  const prompt = buildAgentPrompt(config, context);

  logger.info('Setting sources: project (harness do repositório)');

  return runAgentStream(
    config,
    {
      name: `${config.projectName} Cursor Reviewer`,
      prompt,
    },
    logger,
  );
}
