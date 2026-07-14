import { AdoClient } from './client.js';
export interface WorkItemSummary {
    id: number;
    type: string;
    title: string;
}
/** Mensagem de log quando work items ADO são carregados para o prompt do agente. */
export declare function formatWorkItemsLoadedLogMessage(summaries: WorkItemSummary[]): string;
/** Monta a seção de WIs para o prompt — deixa explícito que não é a descrição da PR. */
export declare function buildWorkItemContextForLlm(sections: string[]): string;
export declare function getPullRequestWorkItemContext(client: AdoClient, pullRequestId: number, maxWorkItems?: number, log?: (msg: string) => void): Promise<{
    workItemIds: number[];
    contextForLlm: string;
    summaries: WorkItemSummary[];
}>;
//# sourceMappingURL=work-items.d.ts.map