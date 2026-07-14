import { formatCommentForPosting } from './format-thread.js';
import { DEFAULT_SCORE_MIN, filterPublishableReviews, isPublishableReview, } from './review-validation.js';
import { normalizeFilePath, reviewDedupKey as pathLineDedupKey } from './utils.js';
import { RESOLUTION_MARKER, REVIEW_SUMMARY_MARKER } from '../git/markers.js';
import { testReviewSummaryAlreadyPosted } from './review-context.js';
import { sanitizeReviewSummaryForPlatform } from './review-summary.js';
function reviewDedupKey(review) {
    return pathLineDedupKey(review.fileName, review.lineNumber);
}
export function parseCodeReviewResponse(raw, scoreMin = DEFAULT_SCORE_MIN) {
    const incoming = raw.reviews ?? [];
    const flattenedIncoming = [];
    const seenKeys = new Set();
    for (const review of incoming) {
        const parentKey = reviewDedupKey(review);
        if (!seenKeys.has(parentKey)) {
            seenKeys.add(parentKey);
            flattenedIncoming.push(review);
        }
        else if (isPublishableReview(review, scoreMin)) {
            const idx = flattenedIncoming.findIndex((r) => reviewDedupKey(r) === parentKey);
            if (idx >= 0 && !isPublishableReview(flattenedIncoming[idx], scoreMin)) {
                flattenedIncoming[idx] = review;
            }
        }
        if (review.relatedOccurrences && review.relatedOccurrences.length > 0) {
            for (const occ of review.relatedOccurrences) {
                const occKey = reviewDedupKey(occ);
                const flattenedOcc = {
                    ...review,
                    fileName: occ.fileName,
                    lineNumber: occ.lineNumber,
                    relatedOccurrences: undefined,
                    comment: `*(Ocorrência similar identificada)*\n\n${review.comment}`,
                };
                if (seenKeys.has(occKey)) {
                    if (isPublishableReview(flattenedOcc, scoreMin)) {
                        const idx = flattenedIncoming.findIndex((r) => reviewDedupKey(r) === occKey);
                        if (idx >= 0 && !isPublishableReview(flattenedIncoming[idx], scoreMin)) {
                            flattenedIncoming[idx] = flattenedOcc;
                        }
                    }
                    continue;
                }
                seenKeys.add(occKey);
                flattenedIncoming.push(flattenedOcc);
            }
        }
    }
    const reviews = filterPublishableReviews(flattenedIncoming, scoreMin);
    if (reviews.length < flattenedIncoming.length) {
        const belowMinLabel = scoreMin > 0 ? `score < ${scoreMin}` : 'score inválido';
        console.warn(`Policy: ${flattenedIncoming.length - reviews.length} review(s) descartado(s) — ${belowMinLabel}, campos obrigatórios ausentes ou contrato inválido.`);
    }
    const resolvedThreads = raw.resolvedThreads ?? [];
    const reviewSummary = raw.reviewSummary ?? '';
    const hasCriticalReviews = reviews.some((review) => review.severity === 'critical');
    return {
        reviews,
        resolvedThreads,
        reviewSummary,
        hasCriticalReviews,
        reviewsJson: JSON.stringify({ reviews }),
    };
}
export { isPublishableReview };
export function getCodeReviewPostingPlan(parsed, hasExternalPendingThreads) {
    // `parsed.reviews` já passou pelo gate autoritativo em parseCodeReviewResponse
    // (filterPublishableReviews). O filtro defensivo final fica em setPullRequestComments,
    // no boundary de POST do ADO.
    const reviews = parsed.reviews;
    let summary = parsed.reviewSummary;
    if (reviews.length > 0 && summary.trim()) {
        if (parsed.hasCriticalReviews) {
            console.warn('Policy: reviewSummary ignored because critical reviews are present.');
            summary = '';
        }
        else {
            console.warn(`Policy: agent returned reviews and reviewSummary together; keeping ${reviews.length} review(s), clearing reviewSummary.`);
            summary = '';
        }
    }
    const canPostSummary = summary.trim().length > 0 && !parsed.hasCriticalReviews && reviews.length === 0 && !hasExternalPendingThreads;
    return {
        reviewsJson: JSON.stringify({ reviews }),
        reviewSummary: summary,
        postSummary: canPostSummary,
    };
}
export function isDuplicateReview(review, existingKeys) {
    return existingKeys.has(reviewDedupKey(review));
}
export function matchesResolvedItem(threadInfo, item) {
    if (item.threadId != null && String(item.threadId) === threadInfo.threadId) {
        return true;
    }
    if (item.fileName && item.lineNumber != null && item.lineNumber > 0) {
        const normalizedFile = normalizeFilePath(item.fileName);
        return normalizedFile === threadInfo.filePath && item.lineNumber === threadInfo.lineNumber;
    }
    return false;
}
export function filterValidResolvedItems(resolvedItems) {
    return resolvedItems.filter((item) => item.threadId != null ||
        (Boolean(item.fileName) && item.lineNumber != null && item.lineNumber > 0));
}
export function isActiveOrPendingStatus(status) {
    const normalized = status.toLowerCase();
    return normalized === 'active' || normalized === 'pending';
}
function collectSimulatedResolvedThreadIds(activeThreads, resolvedItems) {
    const llmResolved = filterValidResolvedItems(resolvedItems);
    const resolvedThreadIds = new Set();
    for (const threadInfo of activeThreads) {
        if (threadInfo.hasResolutionReply && isActiveOrPendingStatus(threadInfo.status)) {
            resolvedThreadIds.add(threadInfo.threadId);
            continue;
        }
        if (threadInfo.hasResolutionReply) {
            continue;
        }
        const match = llmResolved.find((item) => matchesResolvedItem(threadInfo, item));
        if (match) {
            resolvedThreadIds.add(threadInfo.threadId);
        }
    }
    return resolvedThreadIds;
}
/** Espelha a lógica de `resolvePullRequestReviewThreads` sem chamadas ADO (dry-run). */
export function simulateThreadResolution(activeThreads, pendingThreads, resolvedItems) {
    const resolvedThreadIds = collectSimulatedResolvedThreadIds(activeThreads, resolvedItems);
    if (resolvedThreadIds.size === 0) {
        return { resolvedCount: 0, pendingThreads };
    }
    return {
        resolvedCount: resolvedThreadIds.size,
        pendingThreads: pendingThreads.filter((thread) => !resolvedThreadIds.has(thread.threadId)),
    };
}
/** Resolve apenas threads confirmadas pelo agente em `resolvedThreads`. */
export async function resolvePullRequestReviewThreads(client, pullRequestId, botTag, activeThreads, resolvedItems, log) {
    if (activeThreads.length === 0) {
        log('No active review threads to evaluate for resolution.');
        return 0;
    }
    const llmResolved = filterValidResolvedItems(resolvedItems);
    let resolvedCount = 0;
    for (const threadInfo of activeThreads) {
        const patchUrl = `/pullRequests/${pullRequestId}/threads/${threadInfo.threadId}?api-version=7.1`;
        if (threadInfo.hasResolutionReply && isActiveOrPendingStatus(threadInfo.status)) {
            try {
                await client.patch(patchUrl, { status: 'fixed' });
                log(`Recovered stuck thread ${threadInfo.threadId} (PATCH-only after partial resolution).`);
                resolvedCount++;
            }
            catch (error) {
                log(`Error: failed to recover stuck thread ${threadInfo.threadId}: ${String(error)}`);
                throw error;
            }
            continue;
        }
        if (threadInfo.hasResolutionReply) {
            log(`Thread ${threadInfo.threadId} already has a resolution reply. Skipping.`);
            continue;
        }
        const match = llmResolved.find((item) => matchesResolvedItem(threadInfo, item));
        if (!match) {
            continue;
        }
        const reason = match.note?.trim() || 'Issue verificado como corrigido na iteração atual.';
        const replyContent = [
            botTag,
            RESOLUTION_MARKER,
            '',
            'Issue addressed in the current iteration. Marking as resolved.',
            '',
            reason.trim(),
        ].join('\n');
        const replyUrl = `/pullRequests/${pullRequestId}/threads/${threadInfo.threadId}/comments?api-version=7.1`;
        try {
            await client.post(replyUrl, {
                content: replyContent,
                parentCommentId: threadInfo.botCommentId,
                commentType: 1,
            });
        }
        catch (error) {
            log(`Error: failed to post resolution reply on thread ${threadInfo.threadId}: ${String(error)}`);
            throw error;
        }
        try {
            await client.patch(patchUrl, { status: 'fixed' });
            log(`Resolved thread ${threadInfo.threadId} (${threadInfo.filePath}:${threadInfo.lineNumber}).`);
            resolvedCount++;
        }
        catch (error) {
            log(`Error: resolution reply posted but PATCH failed for thread ${threadInfo.threadId}: ${String(error)}`);
            throw error;
        }
    }
    return resolvedCount;
}
export async function setPullRequestReviewSummary(client, pullRequestId, botTag, summaryText, allThreads, log, prTitle, workItems) {
    if (!summaryText.trim()) {
        return false;
    }
    const sanitized = sanitizeReviewSummaryForPlatform(summaryText, {
        pullRequestId,
        prTitle,
        workItemIds: workItems?.map((item) => item.id),
        workItemTitles: workItems?.map((item) => item.title),
        platform: 'ado',
    });
    if (!sanitized) {
        return false;
    }
    if (sanitized !== summaryText.trim()) {
        log('Review summary sanitized (PR vs Work Item references).');
    }
    if (testReviewSummaryAlreadyPosted(allThreads, botTag, sanitized)) {
        log('Review summary already posted with identical content. Skipping.');
        return false;
    }
    const commentContent = [botTag, REVIEW_SUMMARY_MARKER, '', sanitized].join('\n');
    const response = await client.post(`/pullRequests/${pullRequestId}/threads?api-version=7.1`, {
        comments: [
            {
                parentCommentId: 0,
                content: commentContent,
                commentType: 1,
            },
        ],
        status: 'closed',
    });
    log(`Review summary posted (Thread ID: ${response.id}).`);
    return true;
}
export async function setPullRequestComments(client, pullRequestId, botTag, reviewsJson, existingKeys, log, scoreMin = DEFAULT_SCORE_MIN) {
    const posted = [];
    const connection = await client.getConnectionData();
    log(`Authenticated as: ${connection.authenticatedUser.providerDisplayName}`);
    const reviewsObject = JSON.parse(reviewsJson);
    const reviews = (reviewsObject.reviews ?? []).filter((review) => isPublishableReview(review, scoreMin));
    if (reviews.length === 0) {
        log('No reviews to post.');
        return posted;
    }
    const newReviews = reviews.filter((review) => !isDuplicateReview(review, existingKeys));
    if (newReviews.length === 0) {
        log('All comments already exist. No new comments to post.');
        return posted;
    }
    const skipped = reviews.length - newReviews.length;
    if (skipped > 0) {
        log(`Skipping ${skipped} duplicate comment(s).`);
    }
    const failures = [];
    for (const review of newReviews) {
        const commentBody = formatCommentForPosting(review, botTag);
        try {
            const postBody = {
                comments: [
                    {
                        parentCommentId: 0,
                        content: commentBody,
                        commentType: 1,
                    },
                ],
                status: 1,
            };
            if (review.fileName && review.lineNumber > 0) {
                postBody.threadContext = {
                    filePath: review.fileName,
                    rightFileStart: { line: review.lineNumber, offset: 1 },
                    rightFileEnd: { line: review.lineNumber, offset: 1000 },
                };
            }
            const response = await client.post(`/pullRequests/${pullRequestId}/threads?api-version=7.1`, postBody);
            const dedupInfo = `line ${review.lineNumber}`;
            log(`Comment posted on '${review.fileName}' (${dedupInfo}) (Thread ID: ${response.id}).`);
            const botCommentId = response.comments?.[0]?.id ?? 0;
            posted.push({
                threadId: String(response.id),
                botCommentId,
                review,
            });
        }
        catch (error) {
            const failure = `${review.fileName}:${review.lineNumber} — ${String(error)}`;
            log(`Error: failed to post comment on '${review.fileName}' line ${review.lineNumber}: ${String(error)}`);
            failures.push(failure);
        }
    }
    if (failures.length > 0) {
        throw new Error(`Falha ao publicar ${failures.length} review(s):\n${failures.join('\n')}`);
    }
    return posted;
}
export function getNewReviewsFromPlan(reviewsJson, existingKeys, scoreMin = DEFAULT_SCORE_MIN) {
    const reviewsObject = JSON.parse(reviewsJson);
    return (reviewsObject.reviews ?? [])
        .filter((review) => isPublishableReview(review, scoreMin))
        .filter((review) => !isDuplicateReview(review, existingKeys));
}
//# sourceMappingURL=post-comments.js.map