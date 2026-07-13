import { isAzurePipeline } from '../ado/pipeline-logging.js';

export type StreamChannel = 'thinking' | 'assistant';

/**
 * No Azure Pipelines o agente prefixa cada *linha física* de stdout com timestamp.
 * `process.stdout.write` com `\n` no meio do thinking/assistant gera linhas órfãs
 * (sem `[INFO] [thinking]`) — o log parece “quebrado”. Em CI emitimos linha a
 * linha via `console.log` e colapsamos cada bloco em `##[group]`.
 *
 * Localmente mantém streaming parcial (TTY) para feedback em tempo real.
 */
export function createAgentStreamLog(ciOverride?: boolean): AgentStreamLog {
  const ci = ciOverride ?? isAzurePipeline();
  return ci ? new PipelineAgentStreamLog() : new TtyAgentStreamLog();
}

export interface AgentStreamLog {
  write(channel: StreamChannel, text: string): void;
  /** Fecha o canal atual (antes de tool/status/fim do stream). */
  endChannel(): void;
  flush(): void;
}

class TtyAgentStreamLog implements AgentStreamLog {
  private last: StreamChannel | null = null;

  write(channel: StreamChannel, text: string): void {
    if (this.last !== channel) {
      if (this.last !== null) {
        process.stdout.write('\n');
      }
      process.stdout.write(`[${new Date().toISOString()}] [INFO] [${channel}] `);
      this.last = channel;
    }
    process.stdout.write(text);
  }

  endChannel(): void {
    if (this.last !== null) {
      process.stdout.write('\n');
      this.last = null;
    }
  }

  flush(): void {
    this.endChannel();
  }
}

class PipelineAgentStreamLog implements AgentStreamLog {
  private channel: StreamChannel | null = null;
  private buffer = '';
  private groupOpen = false;

  write(channel: StreamChannel, text: string): void {
    if (this.channel !== channel) {
      this.closeChannel();
      this.channel = channel;
      console.log(`##[group][Cursor Reviewer] ${channel}`);
      this.groupOpen = true;
    }
    this.buffer += text;
    this.drain(false);
  }

  endChannel(): void {
    this.closeChannel();
  }

  flush(): void {
    this.closeChannel();
  }

  private closeChannel(): void {
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

  private drain(flushRemainder: boolean): void {
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

  private emitLine(tag: StreamChannel, line: string): void {
    // Linha completa → o coletor ADO não cria órfãs sem prefixo.
    console.log(`[${new Date().toISOString()}] [INFO] [${tag}] ${line}`);
  }
}
