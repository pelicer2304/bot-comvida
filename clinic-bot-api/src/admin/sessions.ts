import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { config } from '../config';

const pool = new Pool({ connectionString: config.postgres.url });

export interface SessionSummary {
  threadId: string;
  step: string;
  pacienteNome?: string;
  lastActivityAt: string;
  tentativasTotal: number;
  agendamentoId?: number;
}

// Lê checkpoints do Postgres (tabela criada pelo LangGraph)
export async function listSessions(): Promise<SessionSummary[]> {
  const { rows } = await pool.query(`
    SELECT DISTINCT ON (thread_id)
      thread_id,
      checkpoint -> 'channel_values' AS state
    FROM checkpoints
    ORDER BY thread_id, checkpoint_id DESC
  `);

  return rows.map((r) => {
    const s = r.state ?? {};
    const tentativas: Record<string, number> = s.tentativas ?? {};
    return {
      threadId: r.thread_id,
      step: s.step ?? 'identificacao',
      pacienteNome: s.paciente?.nome,
      lastActivityAt: s.lastActivityAt ?? new Date().toISOString(),
      tentativasTotal: Object.values(tentativas).reduce((a: number, b) => a + (b as number), 0),
      agendamentoId: s.agendamentoId,
    };
  });
}

export async function getSession(threadId: string) {
  const { rows } = await pool.query(
    `SELECT checkpoint -> 'channel_values' AS state
     FROM checkpoints WHERE thread_id = $1 ORDER BY checkpoint_id DESC LIMIT 1`,
    [threadId]
  );
  if (!rows.length) return null;
  return { threadId, ...rows[0].state };
}

export async function deleteSession(threadId: string) {
  await pool.query('DELETE FROM checkpoints WHERE thread_id = $1', [threadId]);
}

export function getSessionMessages(threadId: string) {
  const safeId = threadId.replace(/[^a-z0-9]/gi, '_');
  const file = join(process.cwd(), 'logs', `${safeId}.jsonl`);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}
