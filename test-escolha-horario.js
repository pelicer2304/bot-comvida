/**
 * test-escolha-horario.js
 *
 * Testa o momento crítico: paciente já identificado + convênio + especialidade definidos,
 * bot apresentou horários, paciente escolhe um — bot DEVE chamar criar_agendamento.
 *
 * Usa um threadId único por execução para não depender de estado anterior.
 */

import { setup, chat, ok, extractCodAgendamento, cancelarSeExistir, BOT_URL } from './test-helpers.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const threadId = `test-flow-${Date.now()}`;

async function getLastToolCalls(threadId) {
  const logFile = join(__dirname, `clinic-bot-api-v2/logs/test_flow_${threadId.replace('test-flow-', '')}.jsonl`);
  try {
    return readFileSync(logFile, 'utf-8')
      .split('\n').filter(Boolean).map(l => JSON.parse(l))
      .filter(l => l.event === 'tool_call')
      .map(l => l.tool);
  } catch { return []; }
}

console.log('=== TESTE: Escolha de Horário → criar_agendamento ===\n');
console.log(`    threadId: ${threadId}\n`);

// ── Pré-condição ──────────────────────────────────────────────────────────────
await setup(threadId);

// ── Fase 1: Levar o bot até apresentar horários ───────────────────────────────
console.log('\n── FASE 1: Identificação + convênio + especialidade ──');
await chat(threadId, 'Oi');
const replyCpf = await chat(threadId, '00000000191');
if (/é você|confirma|encontrei/i.test(replyCpf)) {
  await chat(threadId, 'sim');
} else {
  await chat(threadId, 'Teste dos Santos 1990-06-15 masculino');
}
await chat(threadId, 'particular');
const replyEsp = await chat(threadId, 'cardiologia');

// Extrai um horário da resposta do bot (ex: "11:50", "08:00")
const horaMatch = replyEsp.match(/\b(\d{2}):(\d{2})\b/);
const dataMatch = replyEsp.match(/(\d{2})\/(\d{2})(?:\/(\d{4}))?/);

if (!horaMatch) {
  // Bot não apresentou horário ainda — pedir explicitamente
  console.log('\n  ⚠️  Bot não apresentou horário, pedindo...');
  const replyHorarios = await chat(threadId, 'quais horários estão disponíveis?');
  const h2 = replyHorarios.match(/\b(\d{2}):(\d{2})\b/);
  if (!h2) {
    console.log('\n  ❌ Bot não apresentou nenhum horário. Abortando.');
    process.exit(1);
  }
}

// ── Fase 2: Paciente escolhe horário específico ───────────────────────────────
console.log('\n── FASE 2: Paciente escolhe horário específico ──');

// Pega o primeiro horário mencionado pelo bot
const toolCallsAntes = await getLastToolCalls(threadId);
const replyEscolha = await chat(threadId, horaMatch ? `pode ser ${horaMatch[0]}` : 'pode ser 10:00');

const toolCallsDepois = await getLastToolCalls(threadId);
const novasCalls = toolCallsDepois.slice(toolCallsAntes.length);

console.log(`\n  Tools chamadas após escolha: [${novasCalls.join(', ')}]`);

const chamouCriar = novasCalls.includes('criar_agendamento');
const chamouBuscar = novasCalls.includes('proximos_horarios_livres');

ok('Bot chamou criar_agendamento', chamouCriar);
ok('Bot NÃO chamou proximos_horarios_livres novamente', !chamouBuscar);

// ── Fase 3: Validar agendamento criado ────────────────────────────────────────
console.log('\n── FASE 3: Validar agendamento na API ──');
const codAgendamento = extractCodAgendamento(threadId);
ok('codAgendamento extraído do log', codAgendamento !== null, `cod=${codAgendamento}`);

if (codAgendamento) {
  await cancelarSeExistir(codAgendamento);
}

console.log('\n=== FIM ===');
