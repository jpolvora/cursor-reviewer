import type { ReviewerConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { AdoClient } from '../ado/client.js';
import { getPullRequestContext } from '../ado/pull-request.js';
import { getPullRequestReviewContext } from '../ado/review-context.js';
import { getPullRequestWorkItemContext } from '../ado/work-items.js';
import {
  resolvePullRequestReviewThreads,
  setPullRequestComments,
  setPullRequestReviewSummary,
} from '../ado/post-comments.js';
import { parseRoundStateFromThreads, persistRoundState } from '../ado/round-state.js';
import { emitPipelineReviewOutput } from '../ado/pipeline-logging.js';
import type { PlatformProvider } from './types.js';
import type {
  ActiveThreadInfo,
  CodeReviewItem,
  GateEvaluation,
  PostedReviewThread,
  ReviewContextResult,
} from '../ado/types.js';
import type { RoundStateCommentInput, RoundStateLocation } from '../ado/round-state.js';
import type { TokenUsageTotals } from '../agent/token-usage.js';

export class AdoProvider implements PlatformProvider {
  readonly name = 'azuredevops';
  private config!: ReviewerConfig;
  private ado!: AdoClient;

  async initialize(config: ReviewerConfig, _logger: Logger): Promise<void> {
    this.config = config;
    this.ado = new AdoClient(
      config.organization,
      config.project,
      config.repositoryName,
      config.adoAccessToken,
    );
  }

  async getPullRequestContext(log?: (msg: string) => void) {
    return getPullRequestContext(this.ado, this.config.pullRequestId, log);
  }

  async getPullRequestReviewContext(botTag: string, log: (msg: string) => void): Promise<ReviewContextResult> {
    return getPullRequestReviewContext(this.ado, this.config.pullRequestId, botTag, log);
  }

  async getPullRequestWorkItemContext(maxWorkItems?: number, log?: (msg: string) => void) {
    return getPullRequestWorkItemContext(this.ado, this.config.pullRequestId, maxWorkItems, log);
  }

  async resolvePullRequestReviewThreads(
    botTag: string,
    activeThreads: ActiveThreadInfo[],
    resolvedItems: any[],
    log: (msg: string) => void,
  ): Promise<number> {
    return resolvePullRequestReviewThreads(
      this.ado,
      this.config.pullRequestId,
      botTag,
      activeThreads,
      resolvedItems,
      log,
    );
  }

  async setPullRequestComments(
    botTag: string,
    reviewsJson: string,
    existingKeys: Map<string, boolean>,
    log: (msg: string) => void,
  ): Promise<PostedReviewThread[]> {
    return setPullRequestComments(
      this.ado,
      this.config.pullRequestId,
      botTag,
      reviewsJson,
      existingKeys,
      log,
      this.config.scoreMin,
    );
  }

  async setPullRequestReviewSummary(
    botTag: string,
    summaryText: string,
    allThreads: any,
    log: (msg: string) => void,
    prTitle?: string,
    workItems?: Array<{ id: number; title: string }>,
  ): Promise<boolean> {
    return setPullRequestReviewSummary(
      this.ado,
      this.config.pullRequestId,
      botTag,
      summaryText,
      allThreads,
      log,
      prTitle,
      workItems,
    );
  }

  parseRoundStateFromThreads(allThreads: any, botTag: string): RoundStateLocation {
    return parseRoundStateFromThreads(allThreads, botTag);
  }

  async persistRoundState(
    botTag: string,
    input: RoundStateCommentInput,
    existing: RoundStateLocation,
    log: (msg: string) => void,
  ): Promise<void> {
    return persistRoundState(
      this.ado,
      this.config.pullRequestId,
      botTag,
      input,
      existing,
      log,
    );
  }

  emitPipelineReviewOutput(
    gate: GateEvaluation,
    reviews: CodeReviewItem[],
    dryRun: boolean,
    tokenUsage?: TokenUsageTotals,
    log?: (msg: string) => void,
  ): void {
    emitPipelineReviewOutput(gate, reviews, dryRun, tokenUsage, log);
  }
}
