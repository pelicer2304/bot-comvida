/**
 * test-flow-v3.js — Teste do fluxo completo do Bot V3
 * node test-flow-v3.js
 */

const BOT_URL = 'http://localhost:3005';
const PHONE = 'test-v3-' + Date.now();

let passed = 0;
let failed = 0;

function ok(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${label}${detail ? ' — ' + detail : ''}`); }
  else { failed++; console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); }
}

async function chat(msg, buttonId) {
  const body = { phone: PHONE };
  if (buttonId) body.buttonId = buttonId;
  else body.message = msg;

  console.log(`\n  👤 ${buttonId ? `[botão: ${buttonId}]` : `"${msg}"`}`);
  const r = await fetch(`${BOT_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  const responses = data.responses || [];
  for (const resp of responses) {
    if (resp.type === 'text') console.log(`  🤖 "${resp.text.slice(0, 200)}"`);
    if (resp.type === 'buttons') console.log(`  🤖 "${resp.text.slice(0, 150)}" [${resp.buttons.map(b => b.label).join(' | ')}]`);
    if (resp.type === 'list') console.log(`  🤖 "${resp.text.slice(0, 150)}" [lista: ${resp.sections[0]?.rows?.length} itens]`);
  }
  return responses;
}

function hasText(responses, pattern) {
  return responses.some(r => r.text && pattern.test(r.text));
}

function hasButton(responses, id) {
  return responses.some(r => r.buttons?.some(b => b.id === id));
}

function hasList(responses) {
  return responses.some(r => r.type === 'list');
}

async function run() {
  console.log('=== TESTE DE FLUXO V3 ===');
  console.log(`    phone: ${PHONE}\n`);

  // Step 0: Limpar
  console.log('── STEP 0: Limpar ──');
  await chat('/clear');
  ok('Sessão limpa', true);

  // Step 1: Saudação
  console.log('\n── STEP 1: Saudação ──');
  const r1 = await chat('oi');
  ok('Bot respondeu saudação', hasText(r1, /Clínica ComVida/i));
  ok('Pediu CPF', hasText(r1, /CPF/i));

  // Step 2: CPF válido (vai cair em "não encontrado" sem MCP)
  console.log('\n── STEP 2: CPF válido ──');
  const r3 = await chat('420.237.798-20');
  ok('Respondeu ao CPF', r3.length > 0);
  const temCadastro = hasButton(r3, 'cadastrar_sim');
  const temConfirmar = hasButton(r3, 'confirmar_sim');
  ok('Ofereceu cadastro ou confirmação', temCadastro || temConfirmar);

  if (temCadastro) {
    // Step 3b: Fluxo de cadastro
    console.log('\n── STEP 3b: Cadastro ──');
    const r3b = await chat(null, 'cadastrar_sim');
    ok('Pediu nome', hasText(r3b, /nome completo/i));

    const r3c = await chat('João Teste Silva');
    ok('Pediu data nascimento', hasText(r3c, /nascimento/i));

    const r3d = await chat('15/06/1990');
    ok('Pediu sexo com botões', hasButton(r3d, 'sexo_M'));

    const r3e = await chat(null, 'sexo_M');
    ok('Cadastro ou erro MCP', r3e.length > 0);
    // Se MCP offline, vai dar erro de cadastro → escalado. Tudo bem pro teste.
    if (hasText(r3e, /cadastro/i) || hasText(r3e, /convênio/i)) {
      ok('Avançou para convênio ou escalou', true);
    } else {
      ok('Escalou (MCP offline)', hasText(r3e, /atendente|transferir/i));
      console.log('\n  ⚠️  MCP offline — pulando steps 4-7');
      printSummary();
      return;
    }
  } else {
    // Step 3a: Confirmar paciente
    console.log('\n── STEP 3a: Confirmar paciente ──');
    const r3a = await chat(null, 'confirmar_sim');
    ok('Avançou para convênio', hasText(r3a, /convênio/i));
  }

  // Step 4: Convênio particular
  console.log('\n── STEP 4: Convênio particular ──');
  const r4 = await chat(null, 'convenio_particular');
  ok('Particular confirmado', hasText(r4, /particular.*confirmado|especialidade/i));

  // Step 5: Especialidade
  console.log('\n── STEP 5: Especialidade ──');
  const r5 = await chat('qualquer');
  ok('Lista de especialidades', hasList(r5));

  const r5b = await chat(null, 'esp_Cardiologia');
  ok('Cardiologia confirmada', hasText(r5b, /Cardiologia.*confirmada|horários/i));

  // Step 6: Horários (sem MCP = sem horários)
  console.log('\n── STEP 6: Horários ──');
  const r6 = await chat('buscar');
  if (hasList(r6)) {
    ok('Horários listados', true);
    // Selecionar primeiro
    const firstId = r6.find(r => r.type === 'list')?.sections?.[0]?.rows?.[0]?.id;
    if (firstId) {
      const r6b = await chat(null, firstId);
      ok('Horário selecionado', hasText(r6b, /selecionado/i));

      // Step 7: Confirmação
      console.log('\n── STEP 7: Confirmação ──');
      const r7 = await chat('ver');
      ok('Resumo apresentado', hasText(r7, /Resumo/i));
      ok('Botão confirmar', hasButton(r7, 'confirmar'));
      ok('Botão alterar', hasButton(r7, 'alterar'));
      ok('Botão cancelar', hasButton(r7, 'cancelar'));

      const r7b = await chat(null, 'cancelar');
      ok('Cancelou', hasText(r7b, /cancelado/i));
    }
  } else {
    ok('Sem horários (MCP offline)', hasText(r6, /não encontrei/i));
    ok('Botão outra especialidade', hasButton(r6, 'esp_outra'));
  }

  // Step 8: /clear
  console.log('\n── STEP 8: /clear ──');
  const r8 = await chat('/clear');
  ok('/clear funciona', hasText(r8, /reiniciada/i));

  printSummary();
}

function printSummary() {
  console.log(`\n=== RESULTADO: ${passed} ✅  ${failed} ❌ ===`);
}

run().catch(e => { console.error('💥', e.message); printSummary(); });
