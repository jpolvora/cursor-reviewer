import { commentHasBotTag } from './utils.js';
/** Marcador HTML da thread (geral) que persiste o contador de rodadas de review. */
export const ROUND_STATE_MARKER = '<!-- reviewer-round-state -->';
/**
 * Lê o estado de rodada persistido numa thread geral (sem `filePath`) do bot.
 *
 * O estado é append-free: uma única thread cujo comentário do bot contém
 * `Rodada: N`. Retorna `round = 0` quando ainda não existe.
 */
export function parseRoundStateFromThreads(threads, botTag) {
    const empty = { round: 0, threadId: null, commentId: null };
    if (!threads) {
        return empty;
    }
    for (const thread of threads.value) {
        if (thread.isDeleted || thread.threadContext?.filePath) {
            continue;
        }
        const botComment = thread.comments.find((comment) => !comment.isDeleted &&
            commentHasBotTag(comment.content, botTag, 'contains') &&
            comment.content.includes(ROUND_STATE_MARKER));
        if (!botComment) {
            continue;
        }
        const match = botComment.content.match(/Rodada:\s*(\d+)/i);
        const round = match ? Number.parseInt(match[1], 10) : 0;
        return {
            round: Number.isFinite(round) && round > 0 ? round : 0,
            threadId: thread.id,
            commentId: botComment.id,
        };
    }
    return empty;
}
/**
 * Decide o escalonamento para revisão humana: quando a rodada atual excede o
 * orçamento configurado E ainda há issues abertas (novas ou pendentes).
 */
export function decideRoundEscalation(input) {
    if (input.maxRounds <= 0) {
        return false;
    }
    return input.currentRound > input.maxRounds && input.hasOpenIssues;
}
/**
 * Em escalonamento, mantém apenas achados `critical` (segurança/dados/regra
 * invariante não podem ser suprimidos) e separa os demais para o aviso de
 * handoff humano.
 */
export function splitReviewsForEscalation(reviews) {
    const kept = [];
    const suppressed = [];
    for (const review of reviews) {
        if (review.severity === 'critical') {
            kept.push(review);
        }
        else {
            suppressed.push(review);
        }
    }
    return { kept, suppressed };
}
/** Corpo do comentário de estado de rodada (e aviso de escalonamento). */
export function buildRoundStateComment(botTag, input) {
    const lines = [
        botTag,
        ROUND_STATE_MARKER,
        '',
        `**Estado da revisão automática** — Rodada: ${input.currentRound}${input.maxRounds > 0 ? ` / ${input.maxRounds}` : ''}`,
    ];
    if (input.escalate) {
        lines.push('', '🚦 **Orçamento de rodadas atingido — revisão automática pausada.**', '', `O ciclo automático de correção atingiu ${input.currentRound} rodadas (limite ${input.maxRounds}). ` +
            'Para evitar loop infinito de fix→review, novos apontamentos **não-críticos** deixam de ser publicados automaticamente.', '');
        if (input.suppressedCount > 0) {
            lines.push(`Nesta rodada foram suprimidos **${input.suppressedCount} apontamento(s) não-crítico(s)** (warning/suggestion). ` +
                'Apenas achados **critical** seguem sendo publicados.', '');
        }
        lines.push('👤 **Ação recomendada:** revisão humana das threads abertas restantes; decida manualmente o que corrigir e conclua a PR.');
    }
    return lines.join('\n');
}
/**
 * Persiste/atualiza a thread de estado de rodada. PATCH no comentário quando já
 * existe (mantém uma única thread, sem spam); POST de nova thread caso contrário.
 */
export async function persistRoundState(client, pullRequestId, botTag, input, existing, log) {
    const content = buildRoundStateComment(botTag, input);
    if (existing.threadId != null && existing.commentId != null) {
        await client.patch(`/pullRequests/${pullRequestId}/threads/${existing.threadId}/comments/${existing.commentId}?api-version=7.1`, { content });
        if (input.escalate) {
            await client.patch(`/pullRequests/${pullRequestId}/threads/${existing.threadId}?api-version=7.1`, {
                status: 'active',
            });
        }
        log(`Round-state atualizado (thread ${existing.threadId}, rodada ${input.currentRound}).`);
        return;
    }
    const response = await client.post(`/pullRequests/${pullRequestId}/threads?api-version=7.1`, {
        comments: [{ parentCommentId: 0, content, commentType: 1 }],
        status: input.escalate ? 'active' : 'closed',
    });
    log(`Round-state criado (thread ${response.id}, rodada ${input.currentRound}).`);
}
//# sourceMappingURL=round-state.js.map