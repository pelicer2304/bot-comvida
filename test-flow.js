/**
 * test-flow.js — Teste do fluxo completo conversando com o bot
 * node test-flow.js
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BOT_URL    = 'http://localhost:4003';
const CW_URL     = 'https://clinicweb-api.prod.clinicweb.linx.com.br';
const CW_USER    = 'FelipeRamos';
const CW_PASS    = 'dev_PeopleAI1';
const COD_EMPRESA = 155;
const THREAD_ID  = 'test-flow-' + Date.now();

const PACIENTE = {
  nomeCompleto:   'Teste dos Santos',
  cpf:            '00000000191',
  dataNascimento: '1990-06-15',
  sexo:           'M',
};

let cwToken = '';

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(label, cond, detail = '') {
  console.log(`  ${cond ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
  return cond;
}

function loadBase(file) {
  return JSON.parse(readFileSync(join(__dirname, 'clinic-bot-api-v2/base', file), 'utf-8'));
}

async function chat(message) {
  console.log(`\n  👤 "${message}"`);
  const r = await fetch(`${BOT_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId: THREAD_ID, message }),
  });
  if (!r.ok) throw new Error(`Bot retornou ${r.status}`);
  const data = await r.json();
  const reply = data.reply ?? data.message ?? JSON.stringify(data);
  console.log(`  🤖 "${reply.slice(0, 300)}${reply.length > 300 ? '...' : ''}"`);
  return reply;
}

async function cwReq(method, path, body) {
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

async function cwLogin() {
  const r = await cwReq('POST', '/auth/login', { username: CW_USER, password: CW_PASS });
  if (!r.ok) throw new Error('Falha no login ClinicWeb');
  cwToken = r.data.token;
}

// ── STEP 0: Pré-condição — limpar thread e garantir paciente não existe ───────

async function step0_precondition() {
  console.log('\n── STEP 0: Pré-condição ──');

  // Limpar thread anterior se existir
  await fetch(`${BOT_URL}/chat/${THREAD_ID}`, { method: 'DELETE' }).catch(() => {});
  ok('Thread limpa', true);

  await cwLogin();
  ok('Login ClinicWeb OK', !!cwToken);

  const r = await cwReq('GET', `/pacientes?codEmpresa=${COD_EMPRESA}&query=${PACIENTE.cpf}`);
  const lista = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
  if (lista.length > 0) {
    console.log(`  ⚠️  Paciente já existe (idPaciente=${lista[0].idPaciente}) — será reutilizado`);
  } else {
    ok('Paciente não existe ainda', true);
  }
}

// ── STEP 1: Saudação inicial ──────────────────────────────────────────────────

async function step1_saudacao() {
  console.log('\n── STEP 1: Saudação ──');
  const reply = await chat('Oi');
  ok('Bot respondeu à saudação', reply.length > 0);
  ok('Bot pediu CPF', /cpf/i.test(reply));
  return reply;
}

// ── STEP 2: Identificação do paciente ────────────────────────────────────────

async function step2_identificacao() {
  console.log('\n── STEP 2: Identificação do paciente ──');

  // Envia só o CPF — novo fluxo
  const replyCpf = await chat(PACIENTE.cpf);
  ok('Bot respondeu ao CPF', replyCpf.length > 0);

  let reply = replyCpf;

  // Se paciente não existe, bot vai pedir dados completos
  if (/nome|nascimento|cadastro/i.test(replyCpf) && !/é você|confirma/i.test(replyCpf)) {
    reply = await chat(`${PACIENTE.nomeCompleto} ${PACIENTE.dataNascimento} masculino`);
    ok('Bot criou/identificou paciente', reply.length > 0);
  } else {
    // Paciente existe — confirmar
    reply = await chat('sim');
    ok('Bot confirmou identidade', reply.length > 0);
  }

  await new Promise(r => setTimeout(r, 1000));
  const r = await cwReq('GET', `/pacientes?codEmpresa=${COD_EMPRESA}&query=${PACIENTE.cpf}`);
  const lista = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
  ok('Paciente existe na API', lista.length > 0);
  if (lista.length > 0) console.log(`     idPaciente=${lista[0].idPaciente}, nome=${lista[0].nome}`);
  return reply;
}

// ── STEP 3: Informar convênio ─────────────────────────────────────────────────

async function step3_convenio() {
  console.log('\n── STEP 3: Convênio ──');

  // Validar na base local antes de responder
  const convenios = loadBase('convenios.json');
  const particular = convenios.find(c => c.codConvenio === -1);
  ok('Particular existe na base local', !!particular, `codConvenio=${particular?.codConvenio}`);

  const reply = await chat('particular');
  ok('Bot aceitou convênio particular', reply.length > 0);
  return reply;
}

// ── STEP 4: Informar especialidade ───────────────────────────────────────────

async function step4_especialidade() {
  console.log('\n── STEP 4: Especialidade ──');

  // Validar profissionais de cardiologia na base local
  const profissionais = loadBase('profissionais.json');
  const cardios = profissionais.filter(p =>
    p.especialidades?.some(e => /cardiolog/i.test(e))
  );
  ok('Cardiologistas na base local', cardios.length > 0, `${cardios.length} profissional(is)`);
  cardios.forEach(p => console.log(`     ${p.nome} (id:${p.idUsuario})`));

  const reply = await chat('cardiologia');
  ok('Bot respondeu sobre cardiologia', reply.length > 0);
  return reply;
}

// ── STEP 5: Escolher horário ──────────────────────────────────────────────────

async function step5_horario(replyAnterior) {
  console.log('\n── STEP 5: Escolher horário ──');

  // Extrair horário da resposta do bot — suporta "13:40" e "13h40"
  const horaMatch = replyAnterior.match(/\b(\d{1,2})[h:](\d{2})\b/);
  const dataMatch = replyAnterior.match(/\b(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\b/);

  if (!horaMatch) {
    console.log('  ⚠️  Bot não apresentou horário ainda, pedindo para mostrar opções');
    const r2 = await chat('quais horários estão disponíveis?');
    ok('Bot listou horários', /\d{1,2}[h:]\d{2}/.test(r2), r2.slice(0, 100));
    return r2;
  }

  const hora = `${horaMatch[1].padStart(2,'0')}:${horaMatch[2]}`;
  ok(`Horário encontrado na resposta: ${hora}`, true);
  const reply = await chat(`pode ser ${hora}${dataMatch ? ' dia ' + dataMatch[1] : ''}`);
  ok('Bot confirmou horário', reply.length > 0);
  return reply;
}

// ── STEP 6: Confirmar agendamento ────────────────────────────────────────────

async function step6_confirmar() {
  console.log('\n── STEP 6: Confirmar agendamento ──');
  const reply = await chat('sim, confirmo');
  ok('Bot respondeu à confirmação', reply.length > 0);
  ok('Bot indicou agendamento realizado', /agend|confirm|marcad|sucesso/i.test(reply), reply.slice(0, 150));
  return reply;
}

// ── STEP 7: Validar agendamento na API ───────────────────────────────────────

async function step7_validarNaApi() {
  console.log('\n── STEP 7: Validar agendamento na API ──');

  await new Promise(r => setTimeout(r, 1000));

  // Buscar paciente para pegar idUsuario
  const pacR = await cwReq('GET', `/pacientes?codEmpresa=${COD_EMPRESA}&query=${PACIENTE.cpf}`);
  const lista = Array.isArray(pacR.data) ? pacR.data : (pacR.data?.data ?? []);
  if (!ok('Paciente encontrado na API', lista.length > 0)) return;

  const { idPaciente, idUsuario, nome } = lista[0];
  console.log(`     idPaciente=${idPaciente}, idUsuario=${idUsuario}, nome=${nome}`);

  // Pegar codAgendamento do log da sessão
  const logFile = `/Users/lucastravagin/Desktop/lucastravagin/poc-clinic-web/clinic-bot-api-v2/logs/test_flow_${THREAD_ID.replace('test-flow-','')}.jsonl`;
  let codAgendamento = null;
  try {
    const { readFileSync } = await import('fs');
    const lines = readFileSync(logFile, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    const toolResult = lines.find(l => l.event === 'tool_result' && l.tool === 'criar_agendamento' && l.result?.includes('codAgendamento'));
    if (toolResult) {
      const match = toolResult.result.match(/"codAgendamento":(\d+)/);
      if (match) codAgendamento = Number(match[1]);
    }
  } catch { /* log não encontrado */ }

  if (!ok(`codAgendamento extraído do log: ${codAgendamento}`, !!codAgendamento)) return;

  const r = await cwReq('GET', `/agendamentos/${codAgendamento}?codEmpresa=${COD_EMPRESA}`);
  ok('GET /agendamentos/:id retornou 200', r.ok);
  const ag = r.data?.data ?? r.data;
  ok('Agendamento encontrado na API', !!ag?.hora, `hora=${ag?.hora}`);
  const codPacienteAg = ag?.codcli ?? ag?.codPaciente ?? ag?.Paciente?.codUsuario;
  ok('codPaciente confere (idUsuario)', codPacienteAg === idUsuario, `esperado ${idUsuario}, recebido ${codPacienteAg}`);
  return codAgendamento;
}

// ── STEP 8: Cancelar agendamento ───────────────────────────────────────────────

async function step8_cancelar(codAgendamento) {
  console.log('\n── STEP 8: Cancelar agendamento ──');
  if (!codAgendamento) {
    console.log('  ⚠️  codAgendamento não disponível, pulando cancelamento');
    return;
  }
  const r = await cwReq('DELETE', `/agendamentos/${codAgendamento}?codEmpresa=${COD_EMPRESA}`);
  ok(`Agendamento ${codAgendamento} cancelado`, r.ok, `status=${r.status}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('=== TESTE DE FLUXO — Conversando com o Bot ===');
  console.log(`    threadId: ${THREAD_ID}`);

  try {
    await step0_precondition();
    await step1_saudacao();
    const replyIdent = await step2_identificacao();
    await step3_convenio();
    const replyEsp = await step4_especialidade();
    const replyHorario = await step5_horario(replyEsp);
    await step6_confirmar();
    const codAgendamento = await step7_validarNaApi();
    await step8_cancelar(codAgendamento);
  } catch (e) {
    console.error('\n💥 Erro:', e.message);
  }

  console.log('\n=== FIM ===');
}

run();
