/**
 * test-outro-horario.js — Cenário: paciente rejeita horários e pede outro dia/horário
 * node test-outro-horario.js
 *
 * Valida que o bot:
 * 1. Aceita a recusa do horário sem travar
 * 2. Busca novos horários quando solicitado
 * 3. Apresenta opções alternativas (outro dia, outro médico)
 * 4. Conclui o agendamento com o horário alternativo
 * 5. Cancela o agendamento ao final
 */

import { setup, chat, ok, cwReq, cancelarSeExistir, extractCodAgendamento, PACIENTE, COD_EMPRESA } from './test-helpers.js';

const THREAD_ID = 'test-flow-' + Date.now();

async function run() {
  console.log('=== TESTE: Paciente Rejeita Horários ===');
  console.log(`    threadId: ${THREAD_ID}\n`);

  await setup(THREAD_ID);

  // ── STEP 1-4: Fluxo até apresentação de horários ──
  console.log('\n── STEP 1: Saudação e identificação ──');
  await chat(THREAD_ID, 'Oi');
  await chat(THREAD_ID, `${PACIENTE.nomeCompleto} ${PACIENTE.cpf} ${PACIENTE.dataNascimento} masculino`);
  await chat(THREAD_ID, 'particular');
  const replyEsp = await chat(THREAD_ID, 'cardiologia');
  ok('Bot apresentou horários', /\d{1,2}[h:]\d{2}/.test(replyEsp));

  // ── STEP 2: Rejeitar TODOS os horários apresentados ──
  console.log('\n── STEP 2: Rejeitar horários apresentados ──');
  const r2 = await chat(THREAD_ID, 'não posso em nenhum desses horários');
  ok('Bot não travou', r2.length > 0);
  ok('Bot ofereceu alternativa', /outro|diferente|semana|dia|horário|disponível|buscar/i.test(r2));

  // ── STEP 3: Pedir especificamente outro dia da semana ──
  console.log('\n── STEP 3: Pedir outro dia da semana ──');
  const r3 = await chat(THREAD_ID, 'você tem alguma opção para segunda ou quarta-feira?');
  ok('Bot respondeu sobre outros dias', r3.length > 0);
  ok('Bot buscou ou apresentou horários alternativos',
    /\d{1,2}[h:]\d{2}|segunda|quarta|não há|sem horário|disponível/i.test(r3));

  // ── STEP 4: Pedir horário mais cedo no dia ──
  console.log('\n── STEP 4: Pedir horário mais cedo ──');
  const r4 = await chat(THREAD_ID, 'prefiro de manhã, antes das 10h, tem alguma opção?');
  ok('Bot respondeu sobre horário matutino', r4.length > 0);

  // ── STEP 5: Aceitar qualquer horário disponível ──
  console.log('\n── STEP 5: Aceitar o próximo horário disponível ──');
  const r5 = await chat(THREAD_ID, 'pode ser qualquer horário disponível, me mostra o mais próximo');
  ok('Bot apresentou horário', r5.length > 0);

  // Extrai horário da resposta
  const horaMatch = r5.match(/\b(\d{1,2})[h:](\d{2})\b/);
  const dataMatch = r5.match(/\b(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\b/);

  if (!horaMatch) {
    console.log('  ⚠️  Bot não apresentou horário — tentando forçar');
    const r5b = await chat(THREAD_ID, 'qual o primeiro horário disponível?');
    ok('Bot listou horário na segunda tentativa', /\d{1,2}[h:]\d{2}/.test(r5b));
  }

  // ── STEP 6: Confirmar o horário alternativo ──
  console.log('\n── STEP 6: Confirmar horário alternativo ──');
  const hora = horaMatch ? `${horaMatch[1].padStart(2,'0')}:${horaMatch[2]}` : null;
  const confirmMsg = hora
    ? `pode ser ${hora}${dataMatch ? ' dia ' + dataMatch[1] : ''}`
    : 'pode ser o primeiro horário disponível';

  const r6 = await chat(THREAD_ID, confirmMsg);
  ok('Bot confirmou o horário', r6.length > 0);

  // ── STEP 7: Confirmar agendamento ──
  console.log('\n── STEP 7: Confirmar agendamento ──');
  const r7 = await chat(THREAD_ID, 'sim, confirmo');
  ok('Bot respondeu à confirmação', r7.length > 0);
  ok('Bot indicou agendamento realizado', /agend|confirm|marcad|sucesso/i.test(r7), r7.slice(0, 150));

  // ── STEP 8: Validar na API ──
  console.log('\n── STEP 8: Validar agendamento na API ──');
  await new Promise(r => setTimeout(r, 1000));
  const cod = extractCodAgendamento(THREAD_ID);
  ok('codAgendamento extraído do log', !!cod, `cod=${cod}`);

  if (cod) {
    const r = await cwReq('GET', `/agendamentos/${cod}?codEmpresa=${COD_EMPRESA}`);
    ok('Agendamento existe na API', r.ok, `status=${r.status}`);
  }

  // ── STEP 9: Cancelar ──
  console.log('\n── STEP 9: Cancelar agendamento ──');
  await cancelarSeExistir(cod);

  console.log('\n=== FIM ===');
}

run().catch(e => console.error('\n💥 Erro:', e.message));
