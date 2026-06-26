import type { ReviewerConfig } from '../../config.js';
import type { Logger } from '../../logger.js';
import type { EngineRunOptions, EngineRunResult, ExecutionEngine } from '../types.js';

export class OpencodeEngine implements ExecutionEngine {
  readonly engineName = 'opencode' as const;

  async run(
    _config: ReviewerConfig,
    _options: EngineRunOptions,
    _logger: Logger,
  ): Promise<EngineRunResult> {
    throw new Error('OpencodeEngine: not yet implemented. Set CURSOR_REVIEWER_ENGINE=cursor-sdk.');
  }
}
