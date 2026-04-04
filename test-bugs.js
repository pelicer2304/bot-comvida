/**
 * test-bugs.js — Valida os 6 bugs corrigidos
 * node test-bugs.js [1-6|all]
 */

const BOT_URL = 'http://localhost:4003';
const DEBOUNCE = 11000; // > 10s debounce do bot
const LLM = 20000;

let passed = 0;
let failed = 0;

function ok(label, cond, detail = '') {
  const mark = cond ? '✅' : '❌';
  console.log(`  ${mark} ${label}${detail ? ' — ' + detail : ''}`);
  if (cond) passed++; else failed++;
  return cond;
}

async function chat(threadId, message, waitMs = DEBOUNCE) {
  console.log(`\n  👤 "${message}"`);
  const r = await fetch(`${BOT_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId, message }),
  });
  if (!r.ok) throw new Error(`Bot retornou ${r.status}`);
  const { reply } = await r.json();
  console.log(`  🤖 "${reply.slice(0, 250)}${reply.length > 250 ? '...' : ''}"`);
  await new Promise(r => setTimeout(r, waitMs));
  return reply;
}

async function clear(threadId) {
  await fetch(`${BOT_URL}/chat/${threadId}`, { method: 'DELETE' }).catch(() => {});
  await new Promise(r => setTimeout(r, 500));
}

// ── Bug 1: Especialidade inferida antes de ser perguntada ─────────────────────
async function bug1() {
  console.log('\n━━ BUG 1: Bot NÃO deve buscar horários antes de perguntar especialidade');
  const tid = 'bug1-' + Date.now();
  await clear(tid);

  const r1 = await chat(tid, 'Olá', LLM);
  ok('Bot pediu CPF', /cpf/i.test(r1));

  const r2 = await chat(tid, '47409468823', LLM);
  ok('Bot encontrou paciente', /humberto|encontrei/i.test(r2));

  const r3 = await chat(tid, 'Sim', LLM);
  ok('Bot perguntou convênio', /conv[eê]nio/i.test(r3));

  const r4 = await chat(tid, 'Não tenho convênio', LLM);
  ok('Bot perguntou especialidade (não horários)', /especialidade|sintoma|qual.*consul/i.test(r4));
  ok('Bot NÃO buscou horários prematuramente', !/hor[aá]rio|dispon[ií]vel|\d{2}\/\d{2}/.test(r4));
}

// ── Bug 2+3: buscar_planos_convenio e listar_convenios lendo do base/ ─────────
async function bug2() {
  console.log('\n━━ BUG 2+3: buscar_planos_convenio e listar_convenios devem funcionar sem MCP');
  const tid = 'bug2-' + Date.now();
  await clear(tid);

  await chat(tid, 'Olá', LLM);
  await chat(tid, '46140346835', LLM); // Lucas — existe na base
  await chat(tid, 'Sim', LLM);

  const r = await chat(tid, 'Amil', LLM);
  ok('Bot reconheceu Amil (sem MCP error)', !/mcp error|n\u00e3o est\u00e1 cadastrado|n\u00e3o encontrei/i.test(r));
  ok('Bot perguntou o plano ou avançou', /plano|especialidade|qual/i.test(r));
}

// ── Bug 4: Convênio com nome persiste corretamente no estado ──────────────────
async function bug4() {
  console.log('\n━━ BUG 4: Convênio informado pelo paciente deve persistir com codConvenio correto');
  const tid = 'bug4-' + Date.now();
  await clear(tid);

  await chat(tid, 'Olá', LLM);
  await chat(tid, '46140346835', LLM);
  await chat(tid, 'Sim', LLM);
  await chat(tid, 'Amil', LLM);
  const r = await chat(tid, 'NEXT GRS', LLM);

  ok('Bot avançou para especialidade após plano', /especialidade|sintoma|qual.*consul/i.test(r));
  ok('Bot NÃO trocou convênio para Particular', !/particular/i.test(r));
}

// ── Bug 5: criar_paciente chamado quando dados completos disponíveis ───────────
async function bug5() {
  console.log('\n━━ BUG 5: Bot deve chamar criar_paciente quando tiver nome + data + sexo');
  const tid = 'bug5-' + Date.now();
  await clear(tid);

  // CPF que não existe
  const cpfNovo = '11144477735';

  await chat(tid, 'Olá', LLM);
  const r1 = await chat(tid, cpfNovo, LLM);
  ok('Bot pediu dados para cadastro', /nome|nascimento|cadastro/i.test(r1));

  const r2 = await chat(tid, 'João Teste da Silva', LLM);
  ok('Bot pediu data/sexo', /nascimento|data|sexo/i.test(r2));

  const r3 = await chat(tid, '15/06/1990\nMasculino', LLM);
  ok('Bot criou cadastro e avançou (não ficou pedindo dados de novo)', /conv[eê]nio|criado|cadastro/i.test(r3));
  ok('Bot NÃO voltou a pedir nome/data/sexo', !/nome completo|data de nascimento/i.test(r3));
}

// ── Bug 6: Erro em tool de convênio NÃO deve escalar ─────────────────────────
async function bug6() {
  console.log('\n━━ BUG 6: Erro em buscar_planos_convenio NÃO deve disparar escalação');
  const tid = 'bug6-' + Date.now();
  await clear(tid);

  await chat(tid, 'Olá', LLM);
  await chat(tid, '47409468823', LLM); // Humberto
  await chat(tid, 'Sim', LLM);
  await chat(tid, 'iamspe', LLM);
  const r = await chat(tid, 'iamspe', LLM);

  ok('Bot NÃO escalou para atendente', !/transferir|atendente|humano/i.test(r));
  ok('Bot continuou o fluxo (perguntou especialidade ou plano)', /especialidade|plano|qual/i.test(r));
}

// ── Runner ────────────────────────────────────────────────────────────────────
const map = { 1: bug1, 2: bug2, 4: bug4, 5: bug5, 6: bug6 };
const arg = process.argv[2] ?? 'all';

console.log('=== TESTE DE BUGS — clinic-bot-api-v2 ===\n');

if (arg === 'all') {
  for (const fn of Object.values(map)) {
    try { await fn(); } catch (e) { console.error('  💥', e.message); failed++; }
  }
} else {
  const fn = map[Number(arg)];
  if (fn) {
    try { await fn(); } catch (e) { console.error('  💥', e.message); failed++; }
  } else {
    console.error(`Cenário ${arg} não existe (1,2,4,5,6)`);
  }
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultado: ${passed} ✅  ${failed} ❌  (total: ${passed + failed})`);
if (failed === 0) console.log('Todos os testes passaram!');
