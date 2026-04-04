// test-full.js — testa os 3 nós (identificacao, convenio, especialidade) com cenários problemáticos
// Uso: node scripts/test-full.js [1-10|all]
import 'dotenv/config';

const BASE_URL = `http://localhost:${process.env.PORT ?? 3002}`;
const PHONE = '5511954502967@s.whatsapp.net';
const DEBOUNCE = 5000;  // > 4s para não juntar mensagens
const LLM = 15000;      // tempo para LLM responder via OpenRouter
const MCP = 18000;      // tempo para MCP + LLM (busca de paciente)

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

async function clear() {
  await send('/clear', 2000);
}

async function showLog(n = 6) {
  const { readFileSync } = await import('fs');
  try {
    const lines = readFileSync(`logs/5511954502967_s_whatsapp_net.jsonl`, 'utf8')
      .trim().split('\n').slice(-n);
    lines.forEach(l => {
      const e = JSON.parse(l);
      console.log(`  ${e.ts.slice(11,19)} ${e.role.padEnd(3)} ${e.message.replace(/\n/g,' | ').slice(0,120)}`);
    });
  } catch { console.log('  (sem log)'); }
}

function log(n, desc) { console.log(`\n━━ CENÁRIO ${n}: ${desc}`); }

// ── CPFs de teste ────────────────────────────────────────────────────────────
// CPF existente: 42023779820 → LUCAS NATALIO SANTOS (idPaciente: 2508523)
// C3/C5 usam CPFs gerados a partir do timestamp para nunca colidir com rodadas anteriores
function gerarCpf(seed) {
  const base = String(seed).padStart(9, '0').slice(-9).split('').map(Number);
  let s = 0;
  for (let i = 0; i < 9; i++) s += base[i] * (10 - i);
  let d1 = (s * 10) % 11; if (d1 >= 10) d1 = 0;
  s = 0;
  for (let i = 0; i < 9; i++) s += base[i] * (11 - i);
  s += d1 * 2;
  let d2 = (s * 10) % 11; if (d2 >= 10) d2 = 0;
  return base.join('') + d1 + d2;
}
const ts = Date.now();
const CPF_C3 = gerarCpf(ts % 1_000_000_000);
const CPF_C5 = gerarCpf((ts + 1) % 1_000_000_000);

// ── Setup helpers ─────────────────────────────────────────────────────────────

async function setupIdentificado() {
  await clear();
  await send('oi', LLM);
  await send('Lucas Travagin', LLM);
  await send('42023779820', MCP);
  await send('sim', LLM);
}

async function setupConvenio(convenio) {
  await setupIdentificado();
  await send(convenio, LLM);
}

// ── Cenários de Identificação ─────────────────────────────────────────────────

async function c1() {
  log(1, 'Usuário manda CPF sem ter dado o nome ainda');
  await clear();
  await send('42023779820', MCP);
  await showLog(4);
}

async function c2() {
  log(2, 'Usuário confirma identidade com "é isso mesmo" (não é sim/não simples)');
  await clear();
  await send('oi quero agendar', LLM);
  await send('Lucas Travagin', LLM);
  await send('42023779820', MCP);
  await send('é isso mesmo, sou eu', LLM);
  await showLog(4);
}

async function c3() {
  log(3, 'Data de nascimento sem separador (05082000) no cadastro');
  await clear();
  await send('oi', LLM);
  await send('TESTE CADASTRO TRES', LLM);
  await send(CPF_C3, MCP);  // CPF gerado por timestamp, nunca cadastrado
  await send('sim', LLM);
  await send('05082000', LLM);
  await send('M', LLM);
  await showLog(8);
}

async function c4() {
  log(4, 'Usuário nega ser o paciente encontrado e tenta outro CPF inexistente');
  await clear();
  await send('oi', LLM);
  await send('João Silva', LLM);
  await send('42023779820', MCP);
  await send('não, não sou eu', LLM);
  await send('11144477735', MCP);  // CPF válido, nunca cadastrado
  await showLog(8);
}

// ── Cenários de Convênio ──────────────────────────────────────────────────────

async function c5() {
  log(5, '"Quero agendar" após cadastro — não deve ser tratado como convênio');
  await clear();
  await send('oi', LLM);
  await send('TESTE CADASTRO CINCO', LLM);
  await send(CPF_C5, MCP);  // CPF gerado por timestamp, nunca cadastrado
  await send('sim', LLM);
  await send('05082000', LLM);
  await send('M', LLM); // cadastro concluído → step=convenio
  await send('quero agendar', LLM);
  await showLog(6);
}

async function c6() {
  log(6, 'Usuário digita convênio com erro de digitação ("Bradesco Saude" sem acento)');
  await setupIdentificado();
  await send('tenho bradesco saude', LLM);
  await showLog(4);
}

async function c7() {
  log(7, 'Usuário pergunta "quais convênios vocês aceitam?" antes de informar o seu');
  await setupIdentificado();
  await send('quais convenios voces aceitam?', LLM);
  await send('tenho unimed', LLM);
  await showLog(6);
}

async function c8() {
  log(8, 'Convênio com múltiplos planos — usuário escolhe com texto ("o primeiro") em vez de número');
  await setupIdentificado();
  await send('saude caixa', LLM);
  await send('quero o primeiro', LLM);
  await showLog(6);
}

// ── Cenários de Especialidade ─────────────────────────────────────────────────

async function c9() {
  log(9, 'Usuário usa sinônimo popular ("dor no coração" → Cardiologia)');
  await setupConvenio('não tenho convênio');
  await send('estou com dor no coração', LLM);
  await showLog(4);
}

async function c10() {
  log(10, 'Usuário manda duas mensagens em 2s (debounce) com a especialidade dividida');
  await setupConvenio('não tenho convênio');
  await fetch(`${BASE_URL}/webhook/evolution/messages-upsert`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'messages.upsert',
      data: { key: { remoteJid: PHONE, fromMe: false }, message: { conversation: 'quero consulta de' } },
    }),
  });
  await new Promise(r => setTimeout(r, 2000));
  await fetch(`${BASE_URL}/webhook/evolution/messages-upsert`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'messages.upsert',
      data: { key: { remoteJid: PHONE, fromMe: false }, message: { conversation: 'cardiologia' } },
    }),
  });
  await new Promise(r => setTimeout(r, LLM));
  await showLog(4);
}

// ── Cenários de Cadastro (regressão Luis Gioia) ─────────────────────────────────

const CPF_C11 = gerarCpf((ts + 2) % 1_000_000_000);
const CPF_C12 = gerarCpf((ts + 3) % 1_000_000_000);

async function c11() {
  log(11, 'Cadastro: "Gostaria" deve ser tratado como sim (regressão Luis Gioia)');
  await clear();
  await send('Olá', LLM);
  await send('Luis Gioia', LLM);
  await send(CPF_C11, MCP);
  await send('Gostaria', LLM);   // deve avançar para pedir data de nascimento
  await showLog(6);
}

async function c12() {
  log(12, 'Cadastro: telefone enviado no lugar da data não deve escalar');
  await clear();
  await send('Olá', LLM);
  await send('Luis Gioia', LLM);
  await send(CPF_C12, MCP);
  await send('Gostaria', LLM);   // avança para cadastro
  await send('11982447656', LLM); // telefone no lugar da data — deve pedir data de novo
  await showLog(8);
}

// ── Runner ────────────────────────────────────────────────────────────────────
const arg = process.argv[2] ?? 'all';
const map = { 1:c1, 2:c2, 3:c3, 4:c4, 5:c5, 6:c6, 7:c7, 8:c8, 9:c9, 10:c10, 11:c11, 12:c12 };

if (arg === 'all') {
  for (const fn of Object.values(map)) await fn();
} else {
  const fn = map[Number(arg)];
  if (fn) await fn(); else console.error(`Cenário ${arg} não existe (1-10)`);
}

console.log('\n✅ Finalizado. Log completo: logs/5511954502967_s_whatsapp_net.jsonl');
