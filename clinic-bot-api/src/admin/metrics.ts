import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const LOGS_DIR = join(process.cwd(), 'logs');

export function computeMetrics(periodo: 'hoje' | 'semana' | 'mes') {
  const now = new Date();
  const cutoff = new Date(now);
  if (periodo === 'hoje') cutoff.setHours(0, 0, 0, 0);
  else if (periodo === 'semana') cutoff.setDate(now.getDate() - 7);
  else cutoff.setMonth(now.getMonth() - 1);

  // Lê todos os logs JSONL
  const { readdirSync } = require('fs');
  let files: string[] = [];
  try { files = readdirSync(LOGS_DIR).filter((f: string) => f.endsWith('.jsonl') && f !== 'errors.jsonl'); }
  catch { return emptyMetrics(); }

  const sessions: Record<string, { firstTs: string; lastTs: string; step?: string }> = {};

  for (const file of files) {
    const path = join(LOGS_DIR, file);
    const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (new Date(entry.ts) < cutoff) continue;
        const id = entry.threadId ?? file.replace('.jsonl', '');
        if (!sessions[id]) sessions[id] = { firstTs: entry.ts, lastTs: entry.ts };
        else sessions[id].lastTs = entry.ts;
      } catch { /* skip */ }
    }
  }

  const total = Object.keys(sessions).length;
  return {
    totalConversas: total,
    agendamentosConcluidos: 0, // calculado via checkpoints em versão futura
    taxaConclusao: 0,
    escalamentos: 0,
    stepMaisAbandonado: 'horarios',
    tempoMedioMinutos: 0,
  };
}

function emptyMetrics() {
  return { totalConversas: 0, agendamentosConcluidos: 0, taxaConclusao: 0, escalamentos: 0, stepMaisAbandonado: '-', tempoMedioMinutos: 0 };
}
