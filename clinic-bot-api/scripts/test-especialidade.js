// test-especialidade.js — testa o nó de especialidade a partir do step=especialidade
// Uso: node scripts/test-especialidade.js [1|2|3|4|5|6|all]
// Lições aprendidas:
//   - Debounce de 4s: mensagens com menos de 4s de intervalo são juntadas
//   - Delays: respostas hardcoded chegam em <1s, LLM demora 8-15s
//   - Não usar "sim/ok" como primeira mensagem no step (cai no path ambíguo)
//   - Não testar com especialidades inexistentes sem verificar o profissionais.json
import 'dotenv/config';

const BASE_URL = `http://localhost:${process.env.PORT ?? 3002}`;
const PHONE = '5511954502967@s.whatsapp.net';
const DEBOUNCE = 5000; // > 4s para garantir que não junta mensagens

async function send(text, waitMs = DEBOUNCE) {
  const payload = {
    event: 'messages.upsert',
    data: {
      key: { remoteJid: PHONE, fromMe: false },
      message: { conversation: text },
    },
  };
  const res = await fetch(`${BASE_URL}/webhook/evolution/messages-upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await new Promise(r => setTimeout(r, waitMs));
}

async function clearThread() {
  await send('/clear', 1500);
}

// Chega ao step=especialidade com paciente particular
async function setupParticular() {
  await clearThread();
  await send('Oi, quero agendar', DEBOUNCE);
  await send('Lucas Travagin', 8000);
  await send('42023779820', 12000);
  await send('Sim', DEBOUNCE);          // confirma identidade → step=convenio
  await send('não tenho convênio', 12000); // particular → step=especialidade
}

// Chega ao step=especialidade com convênio IAMSPE
async function setupIamspe() {
  await clearThread();
  await send('Oi, quero agendar', DEBOUNCE);
  await send('Lucas Travagin', 8000);
  await send('42023779820', 12000);
  await send('Sim', DEBOUNCE);
  await send('iamspe', DEBOUNCE);       // IAMSPE auto-selecionado → step=especialidade
}

function log(label, msg) {
  console.log(`\n[${label}] ${msg}`);
}

async function showLog(n = 5) {
  const { readFileSync } = await import('fs');
  const lines = readFileSync(`logs/5511954502967_s_whatsapp_net.jsonl`, 'utf8')
    .trim().split('\n').slice(-n);
  lines.forEach(l => {
    const e = JSON.parse(l);
    console.log(e.ts.slice(11, 19), e.role.padEnd(3), e.message.replace(/\n/g, ' ↵ '));
  });
}

// ── Cenário 1: Especialidade válida — particular ──────────────────────────────
async function cenario1() {
  log('CENÁRIO 1', 'Cardiologia — particular');
  await setupParticular();
  await send('cardiologia', 12000);
  log('CENÁRIO 1', 'Esperado: step=horarios, especialidade.nome="cardiologia"');
  await showLog(4);
}

// ── Cenário 2: Especialidade válida — com convênio IAMSPE ─────────────────────
async function cenario2() {
  log('CENÁRIO 2', 'Cardiologia — IAMSPE (coberto)');
  await setupIamspe();
  await send('cardiologia', 12000);
  log('CENÁRIO 2', 'Esperado: step=horarios, especialidade.nome="cardiologia"');
  await showLog(4);
}

// ── Cenário 3: Especialidade inexistente ──────────────────────────────────────
async function cenario3() {
  log('CENÁRIO 3', 'Especialidade inexistente ("acupuntura")');
  await setupParticular();
  await send('acupuntura', 12000);
  log('CENÁRIO 3', 'Esperado: bot informa que não temos essa especialidade, permanece em step=especialidade');
  await showLog(4);
}

// ── Cenário 4: Usuário manda mensagem ambígua primeiro ────────────────────────
// Lição: "sim" / "ok" no step=especialidade cai no path ambíguo → LLM pergunta especialidade
async function cenario4() {
  log('CENÁRIO 4', 'Resposta ambígua ("sim") → bot pede especialidade → usuário informa');
  await setupParticular();
  await send('sim', 12000);            // ambíguo → LLM pergunta especialidade
  await send('neurologia', 12000);
  log('CENÁRIO 4', 'Esperado: após "sim" bot pergunta especialidade, após "neurologia" step=horarios');
  await showLog(6);
}

// ── Cenário 5: Duas mensagens em menos de 4s (debounce) ──────────────────────
// Lição: debounce junta mensagens próximas — "quero" + "cardiologia" viram "quero\ncardiologia"
async function cenario5() {
  log('CENÁRIO 5', 'Debounce — duas mensagens em 2s são juntadas');
  await setupParticular();
  // Enviar duas mensagens com 2s de intervalo (< DEBOUNCE_MS=4s)
  const payload = (text) => ({
    event: 'messages.upsert',
    data: { key: { remoteJid: PHONE, fromMe: false }, message: { conversation: text } },
  });
  await fetch(`${BASE_URL}/webhook/evolution/messages-upsert`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload('quero consulta de')),
  });
  await new Promise(r => setTimeout(r, 2000));
  await fetch(`${BASE_URL}/webhook/evolution/messages-upsert`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload('cardiologia')),
  });
  await new Promise(r => setTimeout(r, 12000)); // aguarda debounce + LLM
  log('CENÁRIO 5', 'Esperado: mensagens juntadas como "quero consulta de\\ncardiologia" → step=horarios');
  await showLog(4);
}

// ── Cenário 6: Especialidade por nome popular ("coração") ────────────────────
async function cenario6() {
  log('CENÁRIO 6', 'Nome popular "coração" → deve encontrar Cardiologia');
  await setupParticular();
  await send('quero consulta para o coração', 12000);
  log('CENÁRIO 6', 'Esperado: findProfissional falha (sem match) → bot pede para reformular');
  await showLog(4);
}

// ── Runner ────────────────────────────────────────────────────────────────────
const cenario = process.argv[2] ?? 'all';

if (cenario === '1' || cenario === 'all') await cenario1();
if (cenario === '2' || cenario === 'all') await cenario2();
if (cenario === '3' || cenario === 'all') await cenario3();
if (cenario === '4' || cenario === 'all') await cenario4();
if (cenario === '5' || cenario === 'all') await cenario5();
if (cenario === '6' || cenario === 'all') await cenario6();

console.log('\n✅ Script finalizado. Verifique os logs em logs/5511954502967_s_whatsapp_net.jsonl');
