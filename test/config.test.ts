import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isUnexpandedPipelineMacro, loadConfig } from '../src/config.js';

function withEnv(env: Record<string, string | undefined>, action: () => void): void {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(env)) {
    previous.set(key, process.env[key]);
    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  }

  try {
    action();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe('loadConfig', () => {
  it('falha em dry-run com contexto ADO sem token para não ignorar threads pendentes', () => {
    withEnv(
      {
        CURSOR_API_KEY: 'cursor_test',
        SYSTEM_ACCESSTOKEN: undefined,
        AZURE_DEVOPS_EXT_PAT: undefined,
      },
      () => {
        assert.throws(
          () =>
            loadConfig([
              '--dry-run',
              '--source-branch',
              'refs/heads/feature',
              '--org',
              'org',
              '--project',
              'project',
              '--repo',
              'repo',
              '--pr-id',
              '123',
            ]),
          /Token ADO ausente/,
        );
      },
    );
  });

  it('usa default composer-2.5 quando CURSOR_REVIEWER_MODEL está vazio (pipeline ADO sem variável)', () => {
    withEnv(
      {
        CURSOR_API_KEY: 'cursor_test',
        CURSOR_REVIEWER_MODEL: '',
      },
      () => {
        const config = loadConfig(['--dry-run', '--source-branch', 'refs/heads/feature']);
        assert.equal(config.model, 'composer-2.5');
      },
    );
  });

  it('usa default composer-2.5 quando CURSOR_REVIEWER_MODEL é macro ADO não expandida', () => {
    withEnv(
      {
        CURSOR_API_KEY: 'cursor_test',
        CURSOR_REVIEWER_MODEL: '$(CURSOR_REVIEWER_MODEL)',
      },
      () => {
        const config = loadConfig(['--dry-run', '--source-branch', 'refs/heads/feature']);
        assert.equal(config.model, 'composer-2.5');
      },
    );
  });

  it('detecta macro ADO não expandida', () => {
    assert.equal(isUnexpandedPipelineMacro('$(CURSOR_REVIEWER_MODEL)'), true);
    assert.equal(isUnexpandedPipelineMacro('composer-2.5'), false);
    assert.equal(isUnexpandedPipelineMacro(''), false);
  });

  it('prioriza --pr-id sobre SYSTEM_PULLREQUEST_PULLREQUESTID', () => {
    withEnv(
      {
        CURSOR_API_KEY: 'cursor_test',
        SYSTEM_PULLREQUEST_PULLREQUESTID: '999',
        SYSTEM_ACCESSTOKEN: 'pat_test',
      },
      () => {
        const config = loadConfig([
          '--dry-run',
          '--source-branch',
          'refs/heads/feature',
          '--org',
          'org',
          '--project',
          'project',
          '--repo',
          'repo',
          '--pr-id',
          '123',
        ]);
        assert.equal(config.pullRequestId, 123);
        assert.equal(config.pullRequestIdSource, '--pr-id');
      },
    );
  });

  it('usa SYSTEM_PULLREQUEST_PULLREQUESTID na pipeline', () => {
    withEnv(
      {
        CURSOR_API_KEY: 'cursor_test',
        SYSTEM_PULLREQUEST_PULLREQUESTID: '456',
      },
      () => {
        const config = loadConfig(['--dry-run', '--source-branch', 'refs/heads/feature']);
        assert.equal(config.pullRequestId, 456);
        assert.equal(config.pullRequestIdSource, 'SYSTEM_PULLREQUEST_PULLREQUESTID');
      },
    );
  });

  it('prioriza --model sobre CURSOR_REVIEWER_MODEL', () => {
    withEnv(
      {
        CURSOR_API_KEY: 'cursor_test',
        CURSOR_REVIEWER_MODEL: 'composer-2.5',
      },
      () => {
        const config = loadConfig([
          '--dry-run',
          '--source-branch',
          'refs/heads/feature',
          '--model',
          'gpt-5.4',
        ]);
        assert.equal(config.model, 'gpt-5.4');
      },
    );
  });

  it('usa maxRounds default 5 e respeita override por env', () => {
    withEnv(
      {
        CURSOR_API_KEY: 'cursor_test',
        CURSOR_REVIEWER_MAX_ROUNDS: undefined,
      },
      () => {
        const config = loadConfig(['--dry-run', '--source-branch', 'refs/heads/feature']);
        assert.equal(config.maxRounds, 5);
      },
    );

    withEnv(
      {
        CURSOR_API_KEY: 'cursor_test',
        CURSOR_REVIEWER_MAX_ROUNDS: '7',
      },
      () => {
        const config = loadConfig(['--dry-run', '--source-branch', 'refs/heads/feature']);
        assert.equal(config.maxRounds, 7);
      },
    );

    withEnv(
      {
        CURSOR_API_KEY: 'cursor_test',
        CURSOR_REVIEWER_MAX_ROUNDS: '0',
      },
      () => {
        const config = loadConfig(['--dry-run', '--source-branch', 'refs/heads/feature']);
        assert.equal(config.maxRounds, 0);
      },
    );

    withEnv(
      {
        CURSOR_API_KEY: 'cursor_test',
        CURSOR_REVIEWER_MAX_ROUNDS: '$(CURSOR_REVIEWER_MAX_ROUNDS)',
      },
      () => {
        const config = loadConfig(['--dry-run', '--source-branch', 'refs/heads/feature']);
        assert.equal(config.maxRounds, 5);
      },
    );
  });

  it('falha na inicialização com modelo inválido', () => {
    withEnv(
      {
        CURSOR_API_KEY: 'cursor_test',
        CURSOR_REVIEWER_MODEL: 'gpt-5.4-medium',
      },
      () => {
        assert.throws(
          () => loadConfig(['--dry-run', '--source-branch', 'refs/heads/feature']),
          /Modelo inválido/,
        );
      },
    );
  });
});
