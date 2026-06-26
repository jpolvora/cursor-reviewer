import { buildAgentPrompt } from './prompt.js';
import { runAgentStream } from './stream.js';
export async function runCodeReviewAgent(config, context, logger) {
    const prompt = buildAgentPrompt(config, context);
    logger.info('Setting sources: project (harness do repositório)');
    return runAgentStream(config, {
        name: `${config.projectName} Cursor Reviewer`,
        prompt,
    }, logger);
}
//# sourceMappingURL=runner.js.map