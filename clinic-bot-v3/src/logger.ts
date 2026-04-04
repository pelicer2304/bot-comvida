import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const LOGS_DIR = join(process.cwd(), 'logs');
mkdirSync(LOGS_DIR, { recursive: true });

function write(file: string, entry: object) {
  appendFileSync(join(LOGS_DIR, file), JSON.stringify(entry) + '\n');
}

export function logMessage(phone: string, role: 'user' | 'bot', message: string) {
  const safe = phone.replace(/[^a-z0-9]/gi, '_');
  write(`${safe}.jsonl`, { ts: new Date().toISOString(), phone, role, message: message.slice(0, 2000) });
}

export function logError(context: string, operation: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  write('errors.jsonl', { ts: new Date().toISOString(), context, operation, message });
}
