import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getCodeReviewPostingPlan, getNewReviewsFromPlan, parseCodeReviewResponse } from '../src/ado/post-comments.js';
import { getPullRequestReviewContext } from '../src/ado/review-context.js';
import type { CodeReviewItem } from '../src/ado/types.js';

function validReview(overrides: Partial<CodeReviewItem> = {}): CodeReviewItem {
  return {
    fileName: '/src/Foo.cs',
    lineNumber: 42,
    severity: 'critical',
    comment: 'Problema objetivo',
    score: 10,
    developerAction: 'fix-code',
    analysis: 'Evidência verificada no código.',
    impactPaths: ['/src/Foo.cs'],
    suggestedFix: '```csharp\n// fix\n```',
    ...overrides,
  };
}

describe('getPullRequestReviewContext', () => {
  it('não deduplica novas reviews contra threads já resolvidas', async () => {
    const fakeClient = {
      get: async () => ({
        value: [
          {
            id: 10,
            status: 'fixed',
            threadContext: {
              filePath: '/src/Foo.cs',
              rightFileStart: { line: 42 },
            },
            comments: [
              {
                id: 1,
                parentCommentId: 0,
                content: '[Cursor Reviewer]\nold issue',
                commentType: 1,
              },
            ],
          },
        ],
      }),
    };

    const context = await getPullRequestReviewContext(
      fakeClient as never,
      123,
      '[Cursor Reviewer]',
      () => {},
    );

    const reviewsJson = JSON.stringify({
      reviews: [validReview({ comment: 'bug reintroduced' })],
    });

    assert.equal(context.existingKeys.size, 0);
    assert.equal(getNewReviewsFromPlan(reviewsJson, context.existingKeys).length, 1);
  });

  it('deduplica reviews com barras invertidas contra paths normalizados do ADO', async () => {
    const fakeClient = {
      get: async () => ({
        value: [
          {
            id: 11,
            status: 'active',
            threadContext: {
              filePath: '/src/Foo/AppService.cs',
              rightFileStart: { line: 42 },
            },
            comments: [
              {
                id: 1,
                parentCommentId: 0,
                content: '[Cursor Reviewer]\nactive issue',
                commentType: 1,
              },
            ],
          },
        ],
      }),
    };

    const context = await getPullRequestReviewContext(
      fakeClient as never,
      123,
      '[Cursor Reviewer]',
      () => {},
    );

    const reviewsJson = JSON.stringify({
      reviews: [
        validReview({
          fileName: 'src\\Foo\\AppService.cs',
          comment: 'duplicate issue',
        }),
      ],
    });

    assert.equal(getNewReviewsFromPlan(reviewsJson, context.existingKeys).length, 0);
  });

  it('remove reviews com score baixo antes da publicação e do gate', () => {
    const parsed = parseCodeReviewResponse({
      reviews: [
        validReview({
          fileName: '/src/Low.cs',
          lineNumber: 10,
          severity: 'warning',
          comment: 'low score',
          score: 5,
        }),
        validReview({
          fileName: '/src/High.cs',
          lineNumber: 20,
          severity: 'critical',
          comment: 'high score',
          score: 8,
        }),
      ],
      resolvedThreads: [],
      reviewSummary: '',
    });

    const plan = getCodeReviewPostingPlan(parsed, false);
    const reviews = getNewReviewsFromPlan(plan.reviewsJson, new Map());

    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].fileName, '/src/High.cs');
  });
});
