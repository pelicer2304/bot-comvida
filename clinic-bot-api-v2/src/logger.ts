import { appendFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

const LOGS_DIR = join(process.cwd(), 'logs');
mkdirSync(LOGS_DIR, { recursive: true });

function write(file: string, entry: object) {
  appendFileSync(join(LOGS_DIR, file), JSON.stringify(entry) + '\n');
}

function safeId(threadId: string) {
  return basename(threadId.replace(/[^a-z0-9]/gi, '_'));
}

function ts() {
  return new Date().toISOString();
}

export function logMessage(threadId: string, role: 'user' | 'bot', message: string) {
  write(`${safeId(threadId)}.jsonl`, {
    ts: ts(), event: 'message', threadId, role,
    message: message.slice(0, 2000),
  });
}

export function logToolCall(threadId: string, tool: string, args: unknown) {
  write(`${safeId(threadId)}.jsonl`, {
    ts: ts(), event: 'tool_call', threadId, tool,
    args,
  });
}

export function logToolResult(threadId: string, tool: string, result: string, latencyMs: number) {
  write(`${safeId(threadId)}.jsonl`, {
    ts: ts(), event: 'tool_result', threadId, tool, latencyMs,
    result: result.slice(0, 500),
  });
}

export function logDataAccess(
  threadId: string,
  source: 'base' | 'clinicweb',
  tool: string,
  input: unknown,
  output: unknown,
  latencyMs?: number
) {
  write('data-access.jsonl', {
    ts: ts(), event: 'data_access', threadId, source, tool,
    input,
    output,
    latencyMs,
  });
}

export function logStateUpdate(threadId: string, update: object) {
  write(`${safeId(threadId)}.jsonl`, {
    ts: ts(), event: 'state_update', threadId,
    update,
  });
}

export function logError(threadId: string, context: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const extra: Record<string, unknown> = {};
  if (error && typeof error === 'object') {
    if ('status' in error) extra.status = (error as Record<string, unknown>).status;
    if ('error' in error) extra.body = (error as Record<string, unknown>).error;
  }
  write('errors.jsonl', { ts: ts(), event: 'error', threadId, context, message, ...extra, stack });
}
