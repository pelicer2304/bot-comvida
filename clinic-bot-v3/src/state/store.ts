import pg from 'pg';
import { config } from '../config';
import { SessionState } from './types';

const pool = new pg.Pool({ connectionString: config.postgres.url });

export async function setupDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_sessions (
      phone       TEXT PRIMARY KEY,
      state       JSONB NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export function createSession(phone: string): SessionState {
  const now = new Date().toISOString();
  return {
    phone,
    step: 'saudacao',
    tentativas: {},
    lastActivityAt: now,
    createdAt: now,
  };
}

export async function loadSession(phone: string): Promise<SessionState | null> {
  const { rows } = await pool.query('SELECT state FROM bot_sessions WHERE phone = $1', [phone]);
  return rows[0]?.state ?? null;
}

export async function saveSession(session: SessionState): Promise<void> {
  session.lastActivityAt = new Date().toISOString();
  await pool.query(
    `INSERT INTO bot_sessions (phone, state, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (phone) DO UPDATE SET state = $2, updated_at = NOW()`,
    [session.phone, JSON.stringify(session)]
  );
}

export async function deleteSession(phone: string): Promise<void> {
  await pool.query('DELETE FROM bot_sessions WHERE phone = $1', [phone]);
}

export async function listSessions(): Promise<{ phone: string; step: string; updatedAt: string }[]> {
  const { rows } = await pool.query(
    `SELECT phone, state->>'step' as step, updated_at FROM bot_sessions ORDER BY updated_at DESC LIMIT 50`
  );
  return rows.map(r => ({ phone: r.phone, step: r.step, updatedAt: r.updated_at }));
}
