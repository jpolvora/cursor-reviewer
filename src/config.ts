import { resolve, relative, isAbsolute } from 'node:path';
import {
  assertSupportedCursorReviewerModelId,
  DEFAULT_CURSOR_REVIEWER_MODEL,
} from './agent/model.js';
import { detectSourceBranchRef } from './git/diff.js';
import { ProjectValidationError, resolveProject } from './project.js';

export interface StackConfig {
  name: string;
  includePatterns: string[];
  promptFileName: string;
}

export const STACKS: Record<string, StackConfig> = {
  'abp/angular': {
    name: 'ABP/Angular',
    includePatterns: ['**/*.cs', '**/*.ts', '**/*.html', '*.cs', '*.ts', '*.html'],
    promptFileName: 'abp-angular.md',
  },
  'php/laravel': {
    name: 'PHP/Laravel',
    includePatterns: [
      '**/*.php',
      '**/*.js',
      '**/*.ts',
      '**/*.vue',
      '**/*.html',
      '**/*.css',
      '**/*.json',
      '*.php',
      '*.js',
      '*.ts',
      '*.vue',
      '*.html',
      '*.css',
      '*.json',
    ],
    promptFileName: 'php-laravel.md',
  },
  'nextjs/react': {
    name: 'Next.js/React',
    includePatterns: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.html',
      '**/*.css',
      '**/*.json',
      '*.ts',
      '*.tsx',
      '*.js',
      '*.jsx',
      '*.html',
      '*.css',
      '*.json',
    ],
    promptFileName: 'nextjs-react.md',
  },
  'typescript': {
    name: 'TypeScript',
    includePatterns: ['**/*.ts', '**/*.json', '*.ts', '*.json'],
    promptFileName: 'typescript.md',
  },
};

export function getStackConfig(stackName: string): StackConfig | undefined {
  const normalized = stackName.trim().toLowerCase();
  if (normalized === 'abp/angular' || normalized === 'abp-angular' || normalized === 'abpangular') {
    return STACKS['abp/angular'];
  }
  if (normalized === 'php/laravel' || normalized === 'php-laravel' || normalized === 'phplaravel') {
    return STACKS['php/laravel'];
  }
  if (normalized === 'nextjs/react' || normalized === 'nextjs-react' || normalized === 'nextjs' || normalized === 'react' || normalized === 'next.js/react' || normalized === 'next.js-react') {
    return STACKS['nextjs/react'];
  }
  if (normalized === 'typescript' || normalized === 'ts') {
    return STACKS['typescript'];
  }
  return undefined;
}

export interface ReviewerConfig {
  repoRoot: string;
  cursorApiKey: string;
  model: string;
  botTag: string;
  verbose: boolean;
  dryRun: boolean;
  includeUncommitted: boolean;
  seedTest: boolean;

  sourceBranch: string;
  targetBranch: string;

  provider: 'azuredevops' | 'github';

  organization: string;
  project: string;
  repositoryName: string;
  pullRequestId: number;
  /** Origem do ID da PR: `--pr-id`, `SYSTEM_PULLREQUEST_PULLREQUESTID`, etc. */
  pullRequestIdSource: string;

  adoAccessToken: string;

  includePatterns: string[];
  excludePatterns: string[];

  skillPath: string;
  systemPromptPath: string;
  projectName: string;
  version: string;

  /** Orçamento de rodadas fix→review antes de escalar para revisão humana (0 desabilita). */
  maxRounds: number;
  stack: string;
  stackPromptPath: string | null;
}

export interface CliArgs {
  dryRun?: boolean;
  verbose?: boolean;
  sourceBranch?: string;
  targetBranch?: string;
  organization?: string;
  project?: string;
  repository?: string;
  pullRequestId?: number;
  botTag?: string;
  model?: string;
  repoRoot?: string;
  includeUncommitted?: boolean;
  seedTest?: boolean;
  help?: boolean;
  ado?: boolean;
  gh?: boolean;
  stack?: string;
}

const DEFAULT_INCLUDE = ['**/*.cs', '**/*.ts', '**/*.html', '*.cs', '*.ts', '*.html'];
const DEFAULT_MODEL = DEFAULT_CURSOR_REVIEWER_MODEL;

const BASE_EXCLUDE = ['*/proxy/*', '*/bin/*', '*/obj/*', '*.md', '*.csproj', 'secret.txt'];

const DEFAULT_MAX_ROUNDS = 5;

/** Lê um inteiro >= 0 de env; usa fallback se ausente, inválido ou macro ADO. */
function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || isUnexpandedPipelineMacro(trimmed)) {
    return fallback;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseCsvPatterns(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function resolveExcludePatterns(repoRoot: string, runnerRoot: string): string[] {
  const patterns = [...BASE_EXCLUDE];

  const reviewSelf = parseBool(process.env.CURSOR_REVIEWER_REVIEW_SELF, false);
  if (!reviewSelf) {
    const relPath = relative(repoRoot, runnerRoot);
    if (relPath && !relPath.startsWith('..') && !isAbsolute(relPath)) {
      const normalized = relPath.replace(/\\/g, '/');
      patterns.push(`${normalized}/**`);
    } else {
      patterns.push('scripts/cursor-reviewer/**');
    }
  }

  patterns.push(...parseCsvPatterns(process.env.CURSOR_REVIEWER_EXTRA_EXCLUDE_PATTERNS));

  return patterns;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

/** Macro ADO literal quando a variável não existe no variable group / pipeline. */
export function isUnexpandedPipelineMacro(value: string): boolean {
  return /^\$\([A-Za-z0-9_.]+\)$/.test(value.trim());
}

function resolveOptionalEnv(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || isUnexpandedPipelineMacro(trimmed)) {
    return fallback;
  }
  return trimmed;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg.startsWith('--stack=')) {
      args.stack = arg.slice(8);
      continue;
    }

    switch (arg) {
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--verbose':
        args.verbose = true;
        break;
      case '--quiet':
        args.verbose = false;
        break;
      case '--source-branch':
        args.sourceBranch = next;
        i++;
        break;
      case '--target-branch':
        args.targetBranch = next;
        i++;
        break;
      case '--org':
        args.organization = next;
        i++;
        break;
      case '--project':
        args.project = next;
        i++;
        break;
      case '--repo':
        args.repository = next;
        i++;
        break;
      case '--pr-id':
        args.pullRequestId = Number(next);
        i++;
        break;
      case '--bot-tag':
        args.botTag = next;
        i++;
        break;
      case '--model':
        args.model = next;
        i++;
        break;
      case '--repo-root':
        args.repoRoot = next;
        i++;
        break;
      case '--include-uncommitted':
        args.includeUncommitted = true;
        break;
      case '--seed-test':
        args.seedTest = true;
        break;
      case '--ado':
        args.ado = true;
        break;
      case '--gh':
        args.gh = true;
        break;
      case '--stack':
        args.stack = next;
        i++;
        break;
      default:
        break;
    }
  }

  return args;
}

function extractOrgFromCollectionUri(uri: string): string {
  const trimmed = uri.replace(/\/$/, '');
  if (!trimmed) {
    return '';
  }

  // URL legada: https://{org}.visualstudio.com
  const legacyMatch = trimmed.match(/^https?:\/\/([^.]+)\.visualstudio\.com/i);
  if (legacyMatch) {
    return legacyMatch[1];
  }

  // URL moderna: https://dev.azure.com/{org}
  const parts = trimmed.split('/');
  return parts[3] ?? '';
}

/** Indica de onde veio o ID da PR (pipeline ADO, CLI ou env local). */
export function resolvePullRequestIdSource(cli: CliArgs, pullRequestId: number): string {
  if (pullRequestId <= 0) {
    return '';
  }
  if (cli.pullRequestId != null && cli.pullRequestId > 0) {
    return '--pr-id';
  }
  if (process.env.SYSTEM_PULLREQUEST_PULLREQUESTID?.trim()) {
    return 'SYSTEM_PULLREQUEST_PULLREQUESTID';
  }
  if (process.env.CURSOR_REVIEWER_PR_ID?.trim()) {
    return 'CURSOR_REVIEWER_PR_ID';
  }
  if (process.env.GITHUB_REF?.includes('refs/pull/')) {
    return 'GITHUB_REF';
  }
  return 'desconhecida';
}

function resolveProvider(cli: CliArgs): 'azuredevops' | 'github' {
  if (cli.ado) return 'azuredevops';
  if (cli.gh) return 'github';

  if (
    process.env.GITHUB_ACTIONS === 'true' ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.GITHUB_REPOSITORY
  ) {
    return 'github';
  }

  if (
    process.env.TF_BUILD === 'true' ||
    process.env.SYSTEM_COLLECTIONURI ||
    process.env.CURSOR_REVIEWER_ADO_ORG
  ) {
    return 'azuredevops';
  }

  return 'azuredevops';
}

/** Normaliza ref git: `master` → `refs/heads/master`. */
export function normalizeBranchRef(ref: string): string {
  const trimmed = ref.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith('refs/heads/') || trimmed.startsWith('refs/remotes/')) {
    return trimmed;
  }
  return `refs/heads/${trimmed.replace(/^refs\/heads\//, '')}`;
}

function resolveSourceBranch(cli: CliArgs, repoRoot: string): string {
  const prSource = process.env.SYSTEM_PULLREQUEST_SOURCEBRANCH?.trim();
  if (prSource) {
    return normalizeBranchRef(prSource);
  }

  if (cli.sourceBranch) {
    return normalizeBranchRef(cli.sourceBranch);
  }

  const current = detectSourceBranchRef(repoRoot);
  if (current) {
    return normalizeBranchRef(current);
  }

  return '';
}

function resolveTargetBranch(cli: CliArgs): string {
  const configured =
    cli.targetBranch?.trim() ||
    process.env.SYSTEM_PULLREQUEST_TARGETBRANCH?.trim() ||
    resolveOptionalEnv(process.env.CURSOR_REVIEWER_TARGET_BRANCH, 'refs/heads/master');

  return normalizeBranchRef(configured);
}

export function loadConfig(argv: string[] = process.argv.slice(2)): ReviewerConfig {
  const cli = parseArgs(argv);

  if (cli.help) {
    printHelp();
    process.exit(0);
  }

  const moduleUrl = import.meta.url;
  const repoRootOverride = cli.repoRoot ?? process.env.CURSOR_REVIEWER_REPO_ROOT;
  const resolvedProject = resolveProject(moduleUrl, repoRootOverride);
  const repoRoot = resolvedProject.repoRoot;

  const cursorApiKey = process.env.CURSOR_API_KEY?.trim();
  if (!cursorApiKey) {
    throw new Error('CURSOR_API_KEY é obrigatório. Veja .env.example');
  }

  const sourceBranch = resolveSourceBranch(cli, repoRoot);
  const targetBranch = resolveTargetBranch(cli);

  if (!sourceBranch) {
    throw new Error(
      'Branch de origem não definida. Na pipeline use a branch da PR (SYSTEM_PULLREQUEST_SOURCEBRANCH); localmente esteja em uma branch git ou use --source-branch.',
    );
  }

  const provider = resolveProvider(cli);
  const isAdo = provider === 'azuredevops';

  const organization = isAdo
    ? (cli.organization ??
       process.env.CURSOR_REVIEWER_ADO_ORG ??
       extractOrgFromCollectionUri(process.env.SYSTEM_COLLECTIONURI ?? ''))
    : (cli.organization ??
       process.env.GITHUB_REPOSITORY_OWNER ??
       (process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[0] : '') ??
       '');

  const adoProject = isAdo
    ? (cli.project ?? process.env.SYSTEM_TEAMPROJECT ?? process.env.CURSOR_REVIEWER_ADO_PROJECT ?? '')
    : '';

  const repositoryName = isAdo
    ? (cli.repository ?? process.env.BUILD_REPOSITORY_NAME ?? process.env.CURSOR_REVIEWER_ADO_REPO ?? '')
    : (cli.repository ??
       (process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : '') ??
       '');

  let rawPullRequestId = cli.pullRequestId;
  if (rawPullRequestId == null) {
    if (isAdo) {
      rawPullRequestId = Number(process.env.SYSTEM_PULLREQUEST_PULLREQUESTID ?? process.env.CURSOR_REVIEWER_PR_ID ?? 0);
    } else {
      rawPullRequestId = Number(process.env.CURSOR_REVIEWER_PR_ID ?? 0);
      if (rawPullRequestId <= 0 && process.env.GITHUB_REF) {
        const match = process.env.GITHUB_REF.match(/refs\/pull\/(\d+)\//);
        if (match) {
          rawPullRequestId = Number(match[1]);
        }
      }
    }
  }

  const pullRequestId =
    Number.isInteger(rawPullRequestId) && rawPullRequestId > 0 ? rawPullRequestId : 0;
  const pullRequestIdSource = resolvePullRequestIdSource(cli, pullRequestId);

  const adoAccessToken = isAdo
    ? (process.env.SYSTEM_ACCESSTOKEN?.trim() ?? process.env.AZURE_DEVOPS_EXT_PAT?.trim() ?? '')
    : (process.env.GITHUB_TOKEN?.trim() ?? process.env.GH_TOKEN?.trim() ?? process.env.SYSTEM_ACCESSTOKEN?.trim() ?? '');

  const dryRun = cli.dryRun ?? parseBool(process.env.CURSOR_REVIEWER_DRY_RUN, false);
  const seedTest = cli.seedTest ?? parseBool(process.env.CURSOR_REVIEWER_SEED_TEST, false);
  const includeUncommitted =
    cli.includeUncommitted ??
    (parseBool(process.env.CURSOR_REVIEWER_INCLUDE_UNCOMMITTED, false) || seedTest);

  const hasContext = isAdo
    ? Boolean(organization && adoProject && repositoryName && pullRequestId > 0)
    : Boolean(organization && repositoryName && pullRequestId > 0);

  if (hasContext && !adoAccessToken) {
    throw new Error(
      isAdo
        ? 'Token ADO ausente. Na pipeline use SYSTEM_ACCESSTOKEN; localmente use AZURE_DEVOPS_EXT_PAT. Para dry-run sem consultar threads da PR, omita org/project/repo/pr-id.'
        : 'Token GitHub ausente. Use GITHUB_TOKEN ou GH_TOKEN para permitir o acesso à API do GitHub.'
    );
  }

  const stackEnv = resolveOptionalEnv(process.env.CURSOR_REVIEWER_STACK, 'ABP/Angular');
  const stackName = cli.stack || (seedTest ? 'ABP/Angular' : stackEnv);
  const stackConfig = getStackConfig(stackName);
  if (!stackConfig) {
    throw new Error(
      `Stack "${stackName}" não é suportada. Stacks disponíveis: ABP/Angular, PHP/Laravel, Next.js/React`,
    );
  }

  const stackPromptPath = resolve(
    resolvedProject.runnerRoot,
    'skills',
    'stacks',
    stackConfig.promptFileName,
  );

  return {
    repoRoot,
    cursorApiKey,
    model: assertSupportedCursorReviewerModelId(
      resolveOptionalEnv(cli.model ?? process.env.CURSOR_REVIEWER_MODEL, DEFAULT_MODEL),
    ),
    botTag: cli.botTag ?? process.env.CURSOR_REVIEWER_BOT_TAG ?? '[Cursor Reviewer]',
    verbose: cli.verbose ?? parseBool(process.env.CURSOR_REVIEWER_VERBOSE, true),
    dryRun,
    includeUncommitted,
    seedTest,
    sourceBranch,
    targetBranch,
    provider,
    organization,
    project: adoProject,
    repositoryName,
    pullRequestId,
    pullRequestIdSource,
    adoAccessToken,
    includePatterns: stackConfig.includePatterns,
    excludePatterns: resolveExcludePatterns(repoRoot, resolvedProject.runnerRoot),
    skillPath: resolvedProject.codeReviewSkillPath,
    systemPromptPath: resolvedProject.systemPromptPath,
    projectName: resolvedProject.projectName,
    version: resolvedProject.version,
    maxRounds: parseNonNegativeInt(process.env.CURSOR_REVIEWER_MAX_ROUNDS, DEFAULT_MAX_ROUNDS),
    stack: stackConfig.name,
    stackPromptPath,
  };
}

export { ProjectValidationError };

function printHelp(): void {
  console.log(`
Cursor Reviewer — code review agêntico portável via @cursor/sdk

Uso:
  npm run review -- [opções]

Opções:
  --dry-run              Executa sem publicar threads; exit 0 salvo erro de execução
  --include-uncommitted  Inclui staged/unstaged/untracked vs HEAD além do diff de branch
  --seed-test            Modo validação seed (ativa include-uncommitted + prompt de teste)
  --verbose / --quiet    Controle de logs
  --source-branch REF    Override local da branch da PR (pipeline usa SYSTEM_PULLREQUEST_SOURCEBRANCH)
  --target-branch REF    Branch de comparação do diff (default: refs/heads/master)
  --org, --project, --repo, --pr-id   Contexto Azure DevOps/GitHub
  --bot-tag TAG          Tag do bot
  --model ID             Modelo Cursor (default canônico: composer-2.5)
  --repo-root PATH       Raiz do repositório (default: detectado via scripts/cursor-reviewer)
  --ado / --gh           Define a estratégia de execução/plataforma (Azure DevOps ou GitHub)
  --stack NAME           Stack tecnológica para o review (ABP/Angular, PHP/Laravel, Next.js/React. Default: ABP/Angular)

Pré-requisitos do projeto alvo (obrigatórios — o script encerra se ausentes):
  skills/CODE_REVIEW.md
  skills/SYSTEM_PROMPT.md

Variáveis: CURSOR_API_KEY, CURSOR_REVIEWER_TARGET_BRANCH (default: refs/heads/master),
  CURSOR_REVIEWER_INCLUDE_UNCOMMITTED, CURSOR_REVIEWER_SEED_TEST,
  CURSOR_REVIEWER_REVIEW_SELF, CURSOR_REVIEWER_EXTRA_EXCLUDE_PATTERNS, ...

Branches:
  - Source: sempre a branch da PR (SYSTEM_PULLREQUEST_SOURCEBRANCH na pipeline; branch git atual localmente)
  - Target: CURSOR_REVIEWER_TARGET_BRANCH ou --target-branch (default: refs/heads/master)

Exemplo local:
  npm run review -- --dry-run

Exemplo local com target customizado:
  CURSOR_REVIEWER_TARGET_BRANCH=refs/heads/develop npm run review -- --dry-run
`);
}
