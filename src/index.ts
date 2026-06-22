import { getPullRequestContext } from './ado/pull-request.js';
import { AdoClient } from './ado/client.js';
import { evaluateGate, formatGateSummary } from './ado/gate.js';
import {
  getCodeReviewPostingPlan,
  getNewReviewsFromPlan,
  parseCodeReviewResponse,
  resolvePullRequestReviewThreads,
  setPullRequestComments,
  setPullRequestReviewSummary,
  simulateThreadResolution,
} from './ado/post-comments.js';
import { getPullRequestReviewContext, filterGatePendingThreads } from './ado/review-context.js';
import { getPullRequestWorkItemContext } from './ado/work-items.js';
import type { CodeReviewItem, PendingPrThread, ReviewContextResult } from './ado/types.js';
import { runCodeReviewAgent } from './agent/runner.js';
import { loadConfig, ProjectValidationError } from './config.js';
import { buildDiffPromptSection } from './git/diff-prompt.js';
import {
  formatDiffSizeKb,
  getDiffBreakdown,
  getDiffFileSummaries,
  prepareLocalReviewWorkspace,
  type DiffFileSummary,
} from './git/diff.js';
import { createLogger, type Logger } from './logger.js';
import { emitPipelineReviewOutput } from './ado/pipeline-logging.js';
import { parseAgentReviewOutput } from './parser/review-response.js';
import { buildRulesMap } from './project/rules-map.js';
import { formatCommentForPosting } from './ado/format-thread.js';

function logDiffFileSummaries(
  logger: Logger,
  title: string,
  summaries: DiffFileSummary[],
): void {
  logger.info(`${title}: ${summaries.length}`);
  if (summaries.length === 0) {
    logger.info('  (nenhum)');
    return;
  }
  for (let i = 0; i < summaries.length; i++) {
    const { file, sizeBytes } = summaries[i];
    logger.info(`  ${i + 1}. ${file} (${formatDiffSizeKb(sizeBytes)})`);
  }
}

function formatElapsedMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = ((ms % 60_000) / 1000).toFixed(0);
  return `${mins}m${secs}s`;
}

async function main(): Promise<void> {
  const startTime = performance.now();
  const config = loadConfig();
  const logger = createLogger(config.verbose);

  logger.section(`${config.projectName} Cursor Reviewer`);
  logger.info(`Modo: ${config.dryRun ? 'DRY-RUN' : 'PIPELINE'}`);
  logger.info(`Model: ${config.model}`);
  logger.info(`Verbosity: ${config.verbose ? 'VERBOSE' : 'QUIET'}`);
  logger.info(`Source: ${config.sourceBranch} → Target: ${config.targetBranch}`);
  logger.info(`Repository Root: ${config.repoRoot}`);
  logger.info(`Code-review skill: ${config.skillPath}`);
  logger.info(`System-prompt path: ${config.systemPromptPath}`);
  logger.info(`Include Patterns: ${JSON.stringify(config.includePatterns)}`);
  logger.info(`Exclude Patterns: ${JSON.stringify(config.excludePatterns)}`);
  if (config.includeUncommitted) {
    logger.info('Diff uncommitted: SIM (working tree vs HEAD incluído no escopo)');
  }
  if (config.seedTest) {
    logger.info('Modo: SEED TEST (validação local de detecção)');
  }

  if (config.pullRequestId) {
    logger.info(
      `Pull Request ID: #${config.pullRequestId}` +
        (config.pullRequestIdSource ? ` (fonte: ${config.pullRequestIdSource})` : ''),
    );
    logger.info(
      `ADO Context: org=${config.organization}, project=${config.project}, repo=${config.repositoryName}`,
    );
  }

  logger.section('Preparando repositório local');
  const gitContext = prepareLocalReviewWorkspace(
    config.repoRoot,
    config.sourceBranch,
    config.targetBranch,
    (msg) => logger.info(msg),
  );
  gitContext.includeUncommitted = config.includeUncommitted;

  const diffOptions = { includeUncommitted: config.includeUncommitted };

  const diffStats = getDiffBreakdown(
    config.repoRoot,
    gitContext.diffRange,
    config.includePatterns,
    config.excludePatterns,
    diffOptions,
  );

  logger.section('Git diff — comparação de branches');
  logger.info(
    `Range: ${gitContext.diffRange}${config.includeUncommitted ? ' + working tree (uncommitted)' : ''} (${config.sourceBranch} → ${config.targetBranch})`,
  );

  const filteredDiffOptions = { ...diffOptions, files: diffStats.filteredFiles };
  const diffFileSummaries = getDiffFileSummaries(
    config.repoRoot,
    gitContext.diffRange,
    filteredDiffOptions,
  );

  logger.info(`Arquivos alterados (pré-filtro): ${diffStats.allChangedFiles.length}`);
  logDiffFileSummaries(logger, 'Arquivos elegíveis (pós-filtro)', diffFileSummaries);
  logger.info(`${diffStats.fileCount} arquivo(s) elegível(is) no diff.`);

  const diffSection = buildDiffPromptSection(
    config.repoRoot,
    gitContext.diffRange,
    diffStats.filteredFiles,
    diffOptions,
  );
  if (diffSection.mode !== 'empty') {
    logger.info(
      `Diff no prompt: modo=${diffSection.mode}, ${formatDiffSizeKb(diffSection.totalBytes)}, ` +
        `${diffSection.includedFiles} arquivo(s) incluído(s)` +
        (diffSection.omittedFiles > 0 ? `, ${diffSection.omittedFiles} omitido(s)` : ''),
    );
  }

  const rulesMap = buildRulesMap(config.repoRoot, diffStats.filteredFiles);
  if (rulesMap.uniqueRules.length > 0) {
    logger.info(`Rules pré-mapeadas: ${rulesMap.uniqueRules.length}`);
  }

  const hasAdoContext =
    Boolean(config.organization && config.project && config.repositoryName && config.pullRequestId) &&
    Boolean(config.adoAccessToken);

  if (diffStats.fileCount === 0 && !hasAdoContext) {
    logger.warn('Nenhum arquivo elegível e sem contexto ADO. Encerrando.');
    return;
  }

  if (diffStats.fileCount === 0) {
    logger.warn('Nenhum arquivo elegível no diff — pulando agente; avaliando gate ADO.');
  }

  if (diffStats.fileCount > 20) {
    logger.warn(`PR grande: ${diffStats.fileCount} arquivos elegíveis — revisão completa em todas as fases.`);
  }

  let reviewContext: ReviewContextResult = {
    existingKeys: new Map<string, boolean>(),
    contextForLlm: '',
    activeThreads: [],
    allThreads: null,
    pendingThreads: [],
  };
  let workItemContext = '';
  let prDescriptionContext = '';
  let ado: AdoClient | null = null;

  if (hasAdoContext) {
    ado = new AdoClient(
      config.organization,
      config.project,
      config.repositoryName,
      config.adoAccessToken,
    );

    logger.section('Coletando contexto Azure DevOps');

    const [workItems, prContext, prDetails] = await Promise.all([
      getPullRequestWorkItemContext(ado, config.pullRequestId, 10, (msg) => logger.info(msg)),
      getPullRequestReviewContext(ado, config.pullRequestId, config.botTag, (msg) => logger.info(msg)),
      getPullRequestContext(ado, config.pullRequestId, (msg) => logger.info(msg)),
    ]);

    workItemContext = workItems.contextForLlm;
    reviewContext = prContext;
    prDescriptionContext = prDetails.contextForLlm;
  }

  const agentStartTime = performance.now();
  if (diffStats.fileCount > 0 && config.pullRequestId > 0 && !hasAdoContext) {
    logger.info(`Iniciando revisão somente leitura da PR #${config.pullRequestId}.`);
  }
  const agentResult =
    diffStats.fileCount > 0
      ? await runCodeReviewAgent(
          config,
          {
            workItemContext,
            prDescriptionContext,
            existingReviewContext: reviewContext.contextForLlm,
            rulesContext: rulesMap.contextForPrompt,
            diffSection,
            diffStats,
            gitContext,
          },
          logger,
        )
      : { fullText: '{"reviews":[],"resolvedThreads":[],"reviewSummary":""}', agentId: 'skipped', runId: 'no-diff' };
  const agentElapsed = performance.now() - agentStartTime;

  if (diffStats.fileCount === 0) {
    logger.section('Processando resposta do agente');
    logger.info('Agente omitido — diff vazio com contexto ADO.');
  } else {
    logger.section('Processando resposta do agente');
    logger.info(`Tempo do agente: ${formatElapsedMs(agentElapsed)}`);
  }
  const rawResponse = parseAgentReviewOutput(agentResult.fullText);
  const parsed = parseCodeReviewResponse(rawResponse);

  logger.info(`Reviews: ${parsed.reviews.length}`);
  logger.info(`Resolved threads (agent): ${parsed.resolvedThreads.length}`);
  logger.info(`Has critical: ${parsed.hasCriticalReviews}`);

  for (const review of parsed.reviews) {
    if (review.score != null) {
      logger.debug(
        `  [${review.severity}] score=${review.score} action=${review.developerAction} ${review.fileName}:${review.lineNumber}`,
      );
    }
  }

  if (parsed.reviewSummary) {
    logger.info(`Review summary: ${parsed.reviewSummary.slice(0, 120)}...`);
  }

  let resolvedCount = 0;
  let postedReviews: CodeReviewItem[] = [];
  let pendingThreads = [...reviewContext.pendingThreads];

  const gatePendingBeforePost = filterGatePendingThreads(reviewContext.pendingThreads, config.botTag);
  const wouldPostReviews = getNewReviewsFromPlan(
    getCodeReviewPostingPlan(parsed, gatePendingBeforePost.length > 0).reviewsJson,
    reviewContext.existingKeys,
  );

  if (config.dryRun) {
    logger.section('DRY-RUN — JSON que seria publicado');
    console.log(JSON.stringify(rawResponse, null, 2));
    postedReviews = wouldPostReviews;

    // F3: Dry-run preview formatado
    if (wouldPostReviews.length > 0) {
      logger.section('DRY-RUN — Preview das threads');
      for (const review of wouldPostReviews) {
        const formatted = formatCommentForPosting(review, config.botTag);
        logger.info(`\n┌─ ${review.fileName}:${review.lineNumber} [${review.severity}] score=${review.score ?? '?'}`);
        logger.info(`│ ${formatted.split('\n').join('\n│ ')}`);
        logger.info('└─');
      }
    }

    if (hasAdoContext) {
      const simulated = simulateThreadResolution(
        reviewContext.activeThreads,
        pendingThreads,
        parsed.resolvedThreads,
      );
      resolvedCount = simulated.resolvedCount;
      pendingThreads = simulated.pendingThreads;
      if (resolvedCount > 0) {
        logger.info(
          `[dry-run] Simulando resolução/recuperação: ${resolvedCount} thread(s) removida(s) do gate pendente.`,
        );
      }
    }
  } else if (ado) {
    logger.section('Resolvendo threads confirmadas pelo agente');
    resolvedCount = await resolvePullRequestReviewThreads(
      ado,
      config.pullRequestId,
      config.botTag,
      reviewContext.activeThreads,
      parsed.resolvedThreads,
      (msg) => logger.info(msg),
    );
    logger.info(`Resolved ${resolvedCount} active thread(s).`);

    if (resolvedCount > 0) {
      const afterResolve = await getPullRequestReviewContext(
        ado,
        config.pullRequestId,
        config.botTag,
        (msg) => logger.debug(msg),
      );
      reviewContext.pendingThreads = afterResolve.pendingThreads;
    }

    const gatePendingBeforePost = filterGatePendingThreads(reviewContext.pendingThreads, config.botTag);
    const postingPlan = getCodeReviewPostingPlan(parsed, gatePendingBeforePost.length > 0);

    logger.section('Publicando comentários na PR');
    const postedThreads = await setPullRequestComments(
      ado,
      config.pullRequestId,
      config.botTag,
      postingPlan.reviewsJson,
      reviewContext.existingKeys,
      (msg) => logger.info(msg),
    );
    postedReviews = postedThreads.map((item) => item.review);

    const gateBeforeSummary = evaluateGate({
      newReviews: postedReviews,
      resolvedCount,
      pendingThreads: gatePendingBeforePost,
    });

    if (postingPlan.postSummary && !gateBeforeSummary.shouldFail) {
      logger.section('Publicando resumo final');
      await setPullRequestReviewSummary(
        ado,
        config.pullRequestId,
        config.botTag,
        postingPlan.reviewSummary,
        reviewContext.allThreads,
        (msg) => logger.info(msg),
      );
    } else if (postingPlan.reviewSummary.trim()) {
      logger.info('Skipping final review summary (issues pendentes ou reviews novos).');
    } else {
      logger.info('Skipping final review summary (empty summary or critical issues remain).');
    }

    const refreshedContext = await getPullRequestReviewContext(
      ado,
      config.pullRequestId,
      config.botTag,
      (msg) => logger.debug(msg),
    );
    pendingThreads = refreshedContext.pendingThreads;
  }

  const gatePending = filterGatePendingThreads(pendingThreads, config.botTag);
  const gate = evaluateGate({
    newReviews: postedReviews,
    resolvedCount,
    pendingThreads: gatePending,
  });

  const totalElapsed = performance.now() - startTime;
  logger.section('Concluído');
  logger.info(`Agent: ${agentResult.agentId} | Run: ${agentResult.runId}`);
  logger.info(`Tempo total: ${formatElapsedMs(totalElapsed)}`);
  console.log(formatGateSummary(gate, agentResult.agentId, agentResult.runId, config.dryRun));

  // Visibilidade na build do Azure DevOps (aba Issues + resumo anexado).
  // No-op fora da pipeline; não altera o exit code (issues não bloqueiam).
  emitPipelineReviewOutput(gate, postedReviews, config.dryRun);
}

main()
  .then(() => {
    process.exit(process.exitCode ?? 0);
  })
  .catch((error) => {
    console.error('\n❌ [cursor-reviewer] ERRO FATAL');
    if (error instanceof ProjectValidationError || error instanceof Error) {
      console.error(error.message);
      if (error.stack && process.env.CURSOR_REVIEWER_VERBOSE === 'true') {
        console.error(`\nStack Trace:\n${error.stack}`);
      }
    } else {
      console.error('Erro desconhecido:', error);
    }
    const exitCode = typeof process.exitCode === 'number' && process.exitCode !== 0 ? process.exitCode : 1;
    process.exit(exitCode);
  });
