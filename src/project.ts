import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ProjectLayout {
  applicationDir: string | null;
  angularAppDir: string | null;
}

export interface ResolvedProject {
  runnerRoot: string;
  repoRoot: string;
  projectName: string;
  codeReviewSkillPath: string;
  systemPromptPath: string;
  layout: ProjectLayout;
}

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectValidationError';
  }
}

/** Encerra o processo com mensagem explícita (fail-fast para CI/CD). */
export function failFast(message: string): never {
  throw new ProjectValidationError(message);
}

/** Localiza a raiz do pacote cursor-reviewer (scripts/cursor-reviewer). */
export function resolveRunnerRoot(fromModuleUrl: string): string {
  let current = dirname(fileURLToPath(fromModuleUrl));

  while (true) {
    const marker = resolve(current, 'src/index.ts');
    const pkgPath = resolve(current, 'package.json');

    if (existsSync(marker) && existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string };
        if (pkg.name?.includes('cursor-reviewer')) {
          return resolve(current);
        }
      } catch {
        // continua subindo
      }
    }

    const parent = dirname(current);
    if (parent === current) {
      failFast(
        'Não foi possível localizar scripts/cursor-reviewer. ' +
          'Copie o subprojeto completo para scripts/cursor-reviewer na raiz do repositório alvo.',
      );
    }
    current = parent;
  }
}

export function detectProjectName(repoRoot: string): string {
  return basename(resolve(repoRoot));
}

export function detectProjectLayout(repoRoot: string): ProjectLayout {
  return {
    applicationDir: findApplicationProjectDir(repoRoot),
    angularAppDir: findAngularAppDir(repoRoot),
  };
}

function findApplicationProjectDir(repoRoot: string): string | null {
  const srcDir = resolve(repoRoot, 'src');
  if (!existsSync(srcDir)) {
    return null;
  }

  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name.endsWith('.Application')) {
      return resolve(srcDir, entry.name);
    }
  }

  return null;
}

function findAngularAppDir(repoRoot: string): string | null {
  const candidates = ['angular/src/app', 'src/frontend/src/app', 'client/src/app', 'apps/web/src/app'];

  for (const relative of candidates) {
    const full = resolve(repoRoot, relative);
    if (existsSync(full)) {
      return full;
    }
  }

  return null;
}

/**
 * Valida harness do projeto alvo e retorna paths resolvidos.
 * Falha imediatamente se a estrutura ou as skills obrigatórias estiverem ausentes.
 */
export function resolveProject(
  fromModuleUrl: string,
  repoRootOverride?: string,
): ResolvedProject {
  const runnerRoot = resolveRunnerRoot(fromModuleUrl);
  const defaultRepoRoot = resolve(runnerRoot, '../../');
  let repoRoot = resolve(repoRootOverride ?? defaultRepoRoot);

  if (!existsSync(resolve(repoRoot, '.git'))) {
    if (!repoRootOverride && existsSync(resolve(runnerRoot, '.git'))) {
      repoRoot = runnerRoot;
    } else {
      failFast(
        `Repositório git não encontrado em ${repoRoot}.\n` +
          'Execute o reviewer apontando para um repositório git válido.',
      );
    }
  }

  const codeReviewSkillPath = resolve(runnerRoot, 'skills/CODE_REVIEW.md');
  const systemPromptPath = resolve(runnerRoot, 'skills/SYSTEM_PROMPT.md');

  if (!existsSync(codeReviewSkillPath)) {
    failFast(`Skill obrigatória ausente: ${codeReviewSkillPath}`);
  }
  if (!existsSync(systemPromptPath)) {
    failFast(`System Prompt obrigatório ausente: ${systemPromptPath}`);
  }

  return {
    runnerRoot,
    repoRoot,
    projectName: detectProjectName(repoRoot),
    codeReviewSkillPath,
    systemPromptPath,
    layout: detectProjectLayout(repoRoot),
  };
}
