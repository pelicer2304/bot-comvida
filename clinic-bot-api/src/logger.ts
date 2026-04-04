import { appendFileSync, mkdirSync } from 'fs';
import * as path from 'path';
import { join } from 'path';

const LOGS_DIR = join(process.cwd(), 'logs');
mkdirSync(LOGS_DIR, { recursive: true });

function sanitize(s: string): string {
  return s.replace(/[\r\n]/g, ' ').slice(0, 2000);
}

function writeLog(file: string, entry: object) {
  appendFileSync(join(LOGS_DIR, file), JSON.stringify(entry) + '\n');
}

export function logConversation(threadId: string, role: 'user' | 'bot', message: string) {
  const safeId = threadId.replace(/[^a-z0-9]/gi, '_');
  const file = `${path.basename(safeId)}.jsonl`;
  writeLog(file, { ts: new Date().toISOString(), threadId: sanitize(threadId), role, message: sanitize(message) });
}

export function logError(threadId: string, context: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  writeLog('errors.jsonl', { ts: new Date().toISOString(), threadId, context, message, stack });
}
