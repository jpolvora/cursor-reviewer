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
});
