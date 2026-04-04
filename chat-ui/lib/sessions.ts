// lib/sessions.ts — persiste sessões e logs em disco

import fs from 'fs';
import path from 'path';

const SESSIONS_DIR = path.join(process.cwd(), 'sessions');
const LOGS_DIR = path.join(process.cwd(), 'logs');

[SESSIONS_DIR, LOGS_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));

export interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
  name?: string;
}

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

function sessionPath(id: string) {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

export function loadSession(id: string): Session | null {
  try {
    return JSON.parse(fs.readFileSync(sessionPath(id), 'utf-8'));
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  session.updatedAt = new Date().toISOString();
  fs.writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2));
}

export function createSession(id: string): Session {
  const session: Session = {
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };
  saveSession(session);
  return session;
}

export function listSessions(): { id: string; createdAt: string; updatedAt: string; messageCount: number }[] {
  try {
    return fs
      .readdirSync(SESSIONS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const s: Session = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8'));
        return { id: s.id, createdAt: s.createdAt, updatedAt: s.updatedAt, messageCount: s.messages.length };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function appendLog(sessionId: string, entry: object) {
  const file = path.join(LOGS_DIR, `${sessionId}.jsonl`);
  fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
}
