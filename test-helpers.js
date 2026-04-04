/**
 * test-helpers.js — Helpers compartilhados entre os scripts de teste
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export const __dirname = dirname(fileURLToPath(import.meta.url));

export const BOT_URL    = 'http://localhost:4003';
export const CW_URL     = 'https://clinicweb-api.prod.clinicweb.linx.com.br';
export const CW_USER    = 'FelipeRamos';
export const CW_PASS    = 'dev_PeopleAI1';
export const COD_EMPRESA = 155;

export const PACIENTE = {
  nomeCompleto:   'Teste dos Santos',
  cpf:            '00000000191',
  dataNascimento: '1990-06-15',
  sexo:           'M',
};

let cwToken = '';

export function ok(label, cond, detail = '') {
  console.log(`  ${cond ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
  return cond;
}

export function loadBase(file) {
  return JSON.parse(readFileSync(join(__dirname, 'clinic-bot-api-v2/base', file), 'utf-8'));
}

export async function chat(threadId, message) {
  console.log(`\n  👤 "${message}"`);
  const r = await fetch(`${BOT_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId, message }),
  });
  if (!r.ok) throw new Error(`Bot retornou ${r.status}`);
  const data = await r.json();
  const reply = data.reply ?? data.message ?? JSON.stringify(data);
  console.log(`  🤖 "${reply.slice(0, 400)}${reply.length > 400 ? '...' : ''}"`);
  return reply;
}

export async function cwReq(method, path, body) {
  const h = { 'Content-Type': 'application/json' };
  if (cwToken) h['Authorization'] = `JWT ${cwToken}`;
  const r = await fetch(`${CW_URL}${path}`, {
    method, headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = {}; try { data = JSON.parse(text); } catch {}
  return { status: r.status, ok: r.status < 400, data };
}

export async function cwLogin() {
  const r = await cwReq('POST', '/auth/login', { username: CW_USER, password: CW_PASS });
  if (!r.ok) throw new Error('Falha no login ClinicWeb');
  cwToken = r.data.token;
}

export async function setup(threadId) {
  await fetch(`${BOT_URL}/chat/${threadId}`, { method: 'DELETE' }).catch(() => {});
  await cwLogin();
}

// Extrai codAgendamento do log JSONL da sessão
export function extractCodAgendamento(threadId) {
  const logFile = join(__dirname, `clinic-bot-api-v2/logs/test_flow_${threadId.replace('test-flow-', '')}.jsonl`);
  try {
    const lines = readFileSync(logFile, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    const toolResult = lines.find(l => l.event === 'tool_result' && l.tool === 'criar_agendamento' && l.result?.includes('codAgendamento'));
    if (toolResult) {
      const match = toolResult.result.match(/"codAgendamento":(\d+)/);
      if (match) return Number(match[1]);
    }
  } catch { /* log não encontrado */ }
  return null;
}

export async function cancelarSeExistir(codAgendamento) {
  if (!codAgendamento) return;
  const r = await cwReq('DELETE', `/agendamentos/${codAgendamento}?codEmpresa=${COD_EMPRESA}`);
  ok(`Agendamento ${codAgendamento} cancelado`, r.ok, `status=${r.status}`);
}

// Fluxo base até escolha de horário — retorna { reply, horarios }
export async function fluxoAteHorario(threadId) {
  await chat(threadId, 'Oi');
  const replyCpf = await chat(threadId, PACIENTE.cpf);
  // Se achou cadastro, confirma; se não achou, manda dados completos
  if (/é você|confirma|encontrei/i.test(replyCpf)) {
    await chat(threadId, 'sim');
  } else {
    await chat(threadId, `${PACIENTE.nomeCompleto} ${PACIENTE.dataNascimento} masculino`);
  }
  await chat(threadId, 'particular');
  const replyEsp = await chat(threadId, 'cardiologia');
  const horaMatch = replyEsp.match(/\b(\d{1,2})[h:](\d{2})\b/);
  const dataMatch = replyEsp.match(/\b(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\b/);
  return { replyEsp, horaMatch, dataMatch };
}
