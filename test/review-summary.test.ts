import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeReviewSummaryForPlatform } from '../src/ado/review-summary.js';

describe('sanitizeReviewSummaryForPlatform', () => {
  it('converte PR #N e #N (ID da PR) em PR N sem hash', () => {
    const out = sanitizeReviewSummaryForPlatform(
      'Revisão somente leitura da PR #694 Correções do Agente. Ver #694.',
      { pullRequestId: 694, prTitle: 'Fix estorno' },
    );

    assert.ok(!out.includes('#694'));
    assert.ok(out.includes('PR 694'));
    assert.ok(out.includes('Fix estorno'));
  });

  it('converte #N de Work Item conhecido em Work Item N', () => {
    const out = sanitizeReviewSummaryForPlatform(
      'Alinhado à US #2418 e Task #2419. Escopo da PR 100 ok.',
      {
        pullRequestId: 100,
        prTitle: 'Ajuste login',
        workItemIds: [2418, 2419],
        workItemTitles: ['CRUD de Talhões', 'Criar entidade'],
      },
    );

    assert.ok(!out.includes('#2418'));
    assert.ok(!out.includes('#2419'));
    assert.ok(out.includes('Work Item 2418'));
    assert.ok(out.includes('Work Item 2419'));
    assert.ok(out.includes('PR 100'));
  });

  it('substitui título de WI colado após PR N pelo título real da PR', () => {
    const out = sanitizeReviewSummaryForPlatform(
      'Revisão somente leitura da PR 694 Correções do Agente de Fiscalização - Módulo 3. Nenhum defeito.',
      {
        pullRequestId: 694,
        prTitle: 'Estorno de baixa por compensação',
        workItemTitles: ['Correções do Agente de Fiscalização - Módulo 3'],
      },
    );

    assert.ok(out.includes('PR 694 ("Estorno de baixa por compensação")'));
    assert.ok(!out.includes('Correções do Agente de Fiscalização - Módulo 3'));
  });

  it('neutraliza qualquer #N residual (ADO auto-linka como WI)', () => {
    const out = sanitizeReviewSummaryForPlatform('Ver #999 no board.', {
      pullRequestId: 10,
      prTitle: 'X',
    });

    assert.equal(out, 'Ver Work Item 999 no board.');
  });

  it('retorna vazio para texto em branco', () => {
    assert.equal(sanitizeReviewSummaryForPlatform('   ', { pullRequestId: 1 }), '');
  });

  it('preserva #N de issues no GitHub (autolinks válidos)', () => {
    const input = 'Relacionado à issue #42. Ver também #999.';
    const out = sanitizeReviewSummaryForPlatform(input, {
      pullRequestId: 18,
      platform: 'github',
    });

    assert.equal(out, input);
    assert.ok(out.includes('#42'));
    assert.ok(out.includes('#999'));
    assert.ok(!out.includes('Work Item'));
  });

  it('normaliza PR N para #N no GitHub (autolink da PR)', () => {
    const out = sanitizeReviewSummaryForPlatform('Revisão somente leitura da PR 18. Ver PR #18.', {
      pullRequestId: 18,
      platform: 'github',
    });

    assert.ok(out.includes('#18'));
    assert.ok(!/\bPR\s+18\b/.test(out));
    assert.ok(!out.includes('Work Item'));
  });

  it('corrige título de WI colado no GitHub mantendo #N', () => {
    const out = sanitizeReviewSummaryForPlatform(
      'Revisão somente leitura da #694 Correções do Agente. Nenhum defeito.',
      {
        pullRequestId: 694,
        prTitle: 'Estorno de baixa',
        workItemTitles: ['Correções do Agente'],
        platform: 'github',
      },
    );

    assert.ok(out.includes('#694 ("Estorno de baixa")'));
    assert.ok(!out.includes('Correções do Agente'));
  });

  it('usa sanitização ADO por padrão quando platform omitido', () => {
    const out = sanitizeReviewSummaryForPlatform('Ver #999 no board.', {
      pullRequestId: 10,
      prTitle: 'X',
    });

    assert.equal(out, 'Ver Work Item 999 no board.');
  });

  it('preserva $ no título da PR ao corrigir WI colado (ADO)', () => {
    const prTitle = 'Corrigir estorno de $1000';
    const out = sanitizeReviewSummaryForPlatform(
      'Revisão somente leitura da PR 694 Correções do Agente. Nenhum defeito.',
      {
        pullRequestId: 694,
        prTitle,
        workItemTitles: ['Correções do Agente'],
      },
    );

    assert.ok(out.includes(`PR 694 ("${prTitle}")`));
    assert.ok(!out.includes('Correções do Agente'));
  });

  it('preserva $ no título da PR ao reescrever cabeçalho (ADO)', () => {
    const prTitle = 'Ajuste de $500 no módulo';
    const out = sanitizeReviewSummaryForPlatform('Revisão somente leitura da PR 100. Tudo ok.', {
      pullRequestId: 100,
      prTitle,
    });

    assert.equal(out, `Revisão somente leitura da PR 100 ("${prTitle}"). Tudo ok.`);
  });

  it('preserva $ no título da PR no GitHub', () => {
    const prTitle = 'Fix billing $99';
    const out = sanitizeReviewSummaryForPlatform(
      'Revisão somente leitura da #18 Wrong WI title. Ok.',
      {
        pullRequestId: 18,
        prTitle,
        workItemTitles: ['Wrong WI title'],
        platform: 'github',
      },
    );

    assert.ok(out.includes(`#18 ("${prTitle}")`));
    assert.ok(!out.includes('Wrong WI title'));
  });
});
