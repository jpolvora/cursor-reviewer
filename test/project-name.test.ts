import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { detectProjectName } from '../src/project.js';

describe('detectProjectName', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('prefere BUILD_REPOSITORY_NAME ao basename do checkout (ex.: pasta s no ADO)', () => {
    process.env.BUILD_REPOSITORY_NAME = 'FlorestalERP';
    delete process.env.GITHUB_REPOSITORY;
    assert.equal(detectProjectName('/home/vsts/work/1/s'), 'FlorestalERP');
  });

  it('usa o último segmento de GITHUB_REPOSITORY', () => {
    delete process.env.BUILD_REPOSITORY_NAME;
    process.env.GITHUB_REPOSITORY = 'acme/my-app';
    assert.equal(detectProjectName('/tmp/work'), 'my-app');
  });
});
