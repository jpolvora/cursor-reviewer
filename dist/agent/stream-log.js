import { isAzurePipeline } from '../ado/pipeline-logging.js';
/**
 * No Azure Pipelines o agente prefixa cada *linha física* de stdout com timestamp.
 * `process.stdout.write` com `\n` no meio do thinking/assistant gera linhas órfãs
 * (sem `[INFO] [thinking]`) — o log parece “quebrado”. Em CI emitimos linha a
 * linha via `console.log` e colapsamos cada bloco em `##[group]`.
 *
 * Localmente mantém streaming parcial (TTY) para feedback em tempo real.
 */
export function createAgentStreamLog(ciOverride) {
    const ci = ciOverride ?? isAzurePipeline();
    return ci ? new PipelineAgentStreamLog() : new TtyAgentStreamLog();
}
class TtyAgentStreamLog {
    last = null;
    write(channel, text) {
        if (this.last !== channel) {
            if (this.last !== null) {
                process.stdout.write('\n');
            }
            process.stdout.write(`[${new Date().toISOString()}] [INFO] [${channel}] `);
            this.last = channel;
        }
        process.stdout.write(text);
    }
    endChannel() {
        if (this.last !== null) {
            process.stdout.write('\n');
            this.last = null;
        }
    }
    flush() {
        this.endChannel();
    }
}
class PipelineAgentStreamLog {
    channel = null;
    buffer = '';
    groupOpen = false;
    write(channel, text) {
        if (this.channel !== channel) {
            this.closeChannel();
            this.channel = channel;
            console.log(`##[group][Cursor Reviewer] ${channel}`);
            this.groupOpen = true;
        }
        this.buffer += text;
        this.drain(false);
    }
    endChannel() {
        this.closeChannel();
    }
    flush() {
        this.closeChannel();
    }
    closeChannel() {
        if (this.channel === null) {
            return;
        }
        this.drain(true);
        if (this.groupOpen) {
            console.log('##[endgroup]');
            this.groupOpen = false;
        }
        this.channel = null;
    }
    drain(flushRemainder) {
        const tag = this.channel;
        if (!tag) {
            return;
        }
        let idx = this.buffer.indexOf('\n');
        while (idx >= 0) {
            const line = this.buffer.slice(0, idx);
            this.buffer = this.buffer.slice(idx + 1);
            this.emitLine(tag, line);
            idx = this.buffer.indexOf('\n');
        }
        if (flushRemainder && this.buffer.length > 0) {
            this.emitLine(tag, this.buffer);
            this.buffer = '';
        }
    }
    emitLine(tag, line) {
        // Linha completa → o coletor ADO não cria órfãs sem prefixo.
        console.log(`[${new Date().toISOString()}] [INFO] [${tag}] ${line}`);
    }
}
//# sourceMappingURL=stream-log.js.map