export declare const RESOLUTION_MARKER = "<!-- resolution-reply -->";
/** Marcador legado usado em versões anteriores do provider GitHub. */
export declare const LEGACY_RESOLUTION_MARKER = "<!-- reviewer-resolved -->";
export declare const REVIEW_SUMMARY_MARKER = "<!-- review-summary -->";
/** Detecta reply de resolução (canônico ADO, legado GitHub ou texto histórico). */
export declare function commentBodyHasResolutionReply(body: string, botTag: string): boolean;
//# sourceMappingURL=markers.d.ts.map