// test-horarios.js — testa o fluxo de horários e confirmação
// Uso: node scripts/test-horarios.js [1-8|all]
import 'dotenv/config';

const BASE_URL = `http://localhost:${process.env.PORT ?? 3002}`;
const PHONE = '5511954502967@s.whatsapp.net';
const DEBOUNCE = 5000;
const LLM    = 15000;
const MCP    = 20000; // proximos_horarios_livres é lento

async function send(text, waitMs = DEBOUNCE) {
  const res = await fetch(`${BASE_URL}/webhook/evolution/messages-upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'messages.upsert',
      data: { key: { remoteJid: PHONE, fromMe: false }, message: { conversation: text } },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await new Promise(r => setTimeout(r, waitMs));
}

async function clear() { await send('/clear', 2000); }

async function showLog(n = 8) {
  const { readFileSync } = await import('fs');
  try {
    const lines = readFileSync(`logs/5511954502967_s_whatsapp_net.jsonl`, 'utf8')
      .trim().split('\n').slice(-n);
    lines.forEach(l => {
      const e = JSON.parse(l);
      console.log(`  ${e.ts.slice(11,19)} ${e.role.padEnd(3)} ${e.message.replace(/\n/g,' | ').slice(0,140)}`);
    });
  } catch { console.log('  (sem log)'); }
}

function log(n, desc) { console.log(`\n━━ CENÁRIO ${n}: ${desc}`); }

// ── Setup: chega até step=horarios com Cardiologia particular ─────────────────
async function setupHorarios(especialidade = 'Cardiologia') {
  await clear();
  await send('oi', LLM);
  await send('Lucas Travagin', LLM);
  await send('42023779820', MCP);
  await send('sim', LLM);
  await send('não tenho convênio', LLM);
  await send(especialidade, LLM);  // especialidadeNode — seta step=horarios
  await send('ok', MCP);           // aciona horariosNode (busca MCP)
}

// ── Cenários ──────────────────────────────────────────────────────────────────

async function c1() {
  log(1, 'Cardiologia — bot lista horários (verifica se pergunta período ou mostra direto)');
  await setupHorarios('Cardiologia');
  // Apenas chega no nó — verifica o que o bot responde
  await showLog(6);
}

async function c2() {
  log(2, 'Escolhe período manhã quando há múltiplos períodos');
  await setupHorarios('Cardiologia');
  await send('manhã', MCP);
  await showLog(6);
}

async function c3() {
  log(3, 'Escolhe período tarde');
  await setupHorarios('Cardiologia');
  await send('tarde', MCP);
  await showLog(6);
}

async function c4() {
  log(4, 'Seleciona horário pelo número ("2")');
  await setupHorarios('Cardiologia');
  await send('manhã', MCP);
  await send('2', LLM);
  await showLog(8);
}

async function c5() {
  log(5, 'Seleciona horário por texto ("quero o primeiro")');
  await setupHorarios('Cardiologia');
  await send('manhã', MCP);
  await send('quero o primeiro', LLM);
  await showLog(8);
}

async function c6() {
  log(6, 'Paciente diz que não pode nenhum horário → escala para humano');
  await setupHorarios('Cardiologia');
  await send('manhã', MCP);
  await send('não posso nenhum desses', LLM);
  await showLog(6);
}

async function c7() {
  log(7, 'Paciente diz que não pode nenhum período → escala para humano');
  await setupHorarios('Cardiologia');
  await send('não posso nenhum período', LLM);
  await showLog(4);
}

async function c8() {
  log(8, 'Fluxo completo: escolhe horário → confirma agendamento');
  await setupHorarios('Cardiologia');
  await send('manhã', MCP);
  await send('1', LLM);
  // Agora está em confirmacao — bot mostra resumo
  await send('confirmar', MCP);
  await showLog(10);
}

async function c9() {
  log(9, 'Fluxo completo: escolhe horário → quer alterar especialidade → volta');
  await setupHorarios('Cardiologia');
  await send('manhã', MCP);
  await send('1', LLM);
  await send('quero mudar a especialidade', LLM);
  await showLog(8);
}

async function c10() {
  log(10, 'Fluxo completo: escolhe horário → quer alterar horário → volta para horarios');
  await setupHorarios('Cardiologia');
  await send('manhã', MCP);
  await send('1', LLM);
  await send('quero outro horário', LLM);
  await showLog(8);
}

// ── Runner ────────────────────────────────────────────────────────────────────
const arg = process.argv[2] ?? 'all';
const map = { 1:c1, 2:c2, 3:c3, 4:c4, 5:c5, 6:c6, 7:c7, 8:c8, 9:c9, 10:c10 };

if (arg === 'all') {
  for (const fn of Object.values(map)) await fn();
} else {
  const fn = map[Number(arg)];
  if (fn) await fn(); else console.error(`Cenário ${arg} não existe (1-10)`);
}

console.log('\n✅ Finalizado. Log: logs/5511954502967_s_whatsapp_net.jsonl');
