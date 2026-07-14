export type StreamChannel = 'thinking' | 'assistant';
/**
 * No Azure Pipelines o agente prefixa cada *linha física* de stdout com timestamp.
 * `process.stdout.write` com `\n` no meio do thinking/assistant gera linhas órfãs
 * (sem `[INFO] [thinking]`) — o log parece “quebrado”. Em CI emitimos linha a
 * linha via `console.log` e colapsamos cada bloco em `##[group]`.
 *
 * Localmente mantém streaming parcial (TTY) para feedback em tempo real.
 */
export declare function createAgentStreamLog(ciOverride?: boolean): AgentStreamLog;
export interface AgentStreamLog {
    write(channel: StreamChannel, text: string): void;
    /** Fecha o canal atual (antes de tool/status/fim do stream). */
    endChannel(): void;
    flush(): void;
}
//# sourceMappingURL=stream-log.d.ts.map