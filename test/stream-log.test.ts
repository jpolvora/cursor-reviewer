import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createAgentStreamLog } from '../src/agent/stream-log.js';

describe('createAgentStreamLog — pipeline', () => {
  let lines: string[];
  let originalLog: typeof console.log;

  beforeEach(() => {
    lines = [];
    originalLog = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    };
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it('emite cada linha com prefixo [thinking] e fecha ##[group]', () => {
    const log = createAgentStreamLog(true);
    log.write('thinking', 'linha A\nlinha B\n');
    log.write('thinking', 'linha C');
    log.flush();

    assert.equal(lines[0], '##[group][Cursor Reviewer] thinking');
    assert.match(lines[1], /\[INFO\] \[thinking\] linha A$/);
    assert.match(lines[2], /\[INFO\] \[thinking\] linha B$/);
    assert.match(lines[3], /\[INFO\] \[thinking\] linha C$/);
    assert.equal(lines[4], '##[endgroup]');
  });

  it('fecha o grupo ao trocar para tool (endChannel) e reabre no próximo bloco', () => {
    const log = createAgentStreamLog(true);
    log.write('thinking', 'primeiro\n');
    log.endChannel();
    log.write('assistant', 'ok\n');
    log.flush();

    assert.equal(lines[0], '##[group][Cursor Reviewer] thinking');
    assert.match(lines[1], /\[thinking\] primeiro$/);
    assert.equal(lines[2], '##[endgroup]');
    assert.equal(lines[3], '##[group][Cursor Reviewer] assistant');
    assert.match(lines[4], /\[assistant\] ok$/);
    assert.equal(lines[5], '##[endgroup]');
  });
});
