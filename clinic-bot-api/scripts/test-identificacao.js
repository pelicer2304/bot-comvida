// test-identificacao.js — simula conversa via webhook para testar o nó de identificação
// Uso: node scripts/test-identificacao.js
import 'dotenv/config';

const BASE_URL = `http://localhost:${process.env.PORT ?? 3002}`;
const PHONE = '5511954502967@s.whatsapp.net'; // número de teste

async function send(text, waitMs = 6000) {
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
  await send('/clear');
  await new Promise(r => setTimeout(r, 1000));
}

function log(label, msg) {
  console.log(`\n[${label}] ${msg}`);
}

// ── Cenário 1: Paciente existente ─────────────────────────────────────────────
async function cenario1() {
  log('CENÁRIO 1', 'Paciente existente (CPF 42023779820)');
  await clearThread();
  await send('Oi, quero agendar uma consulta');
  await send('Lucas Travagin', 8000);
  await send('42023779820', 12000); // MCP pode demorar mais
  await send('Sim');
  log('CENÁRIO 1', 'Esperado: step=convenio, paciente.idPaciente=2508523');
}

// ── Cenário 2: Paciente novo — aceita cadastro ────────────────────────────────
async function cenario2() {
  log('CENÁRIO 2', 'Paciente novo (CPF 37952602055) — aceita cadastro');
  await clearThread();
  await send('Oi');
  await send('TESTE DOS SANTOS', 8000);
  await send('37952602055', 15000); // CPF inexistente — MCP pode demorar mais
  await send('Sim, quero me cadastrar', 10000);
  await send('01/01/1990');
  await send('M');
  log('CENÁRIO 2', 'Esperado: step=convenio, paciente criado com nome TESTE DOS SANTOS');
}

// ── Cenário 3: Paciente novo — recusa cadastro ────────────────────────────────
async function cenario3() {
  log('CENÁRIO 3', 'Paciente novo — recusa cadastro');
  await clearThread();
  await send('Oi');
  await send('TESTE DOS SANTOS', 8000);
  await send('99999999900', 15000); // CPF inválido que não existe no sistema
  await send('Não, obrigado');
  log('CENÁRIO 3', 'Esperado: step=escalado');
}

// ── Cenário 4: Data sem separador + continua após cadastro ─────────────────
async function cenario4() {
  log('CENÁRIO 4', 'Novo paciente — data sem separador (05082000) + "Quero agendar" após cadastro');
  await clearThread();
  await send('Oi');
  await send('TESTE SANTOS', 8000);
  await send('763.180.040-50', 15000);
  await send('Sim', 10000);
  await send('05082000', 10000);      // data sem separador
  await send('M', 10000);             // cria paciente → step=convenio
  await send('Quero agendar', 12000); // não deve voltar ao identificacaoNode
  log('CENÁRIO 4', 'Esperado: cadastro criado, "Quero agendar" tratado pelo nó de convênio');
}

// ── Runner ────────────────────────────────────────────────────────────────────
const cenario = process.argv[2] ?? 'all';

if (cenario === '1' || cenario === 'all') await cenario1();
if (cenario === '2' || cenario === 'all') await cenario2();
if (cenario === '3' || cenario === 'all') await cenario3();
if (cenario === '4' || cenario === 'all') await cenario4();

console.log('\n✅ Script finalizado. Verifique os logs em logs/5511954502967_s_whatsapp_net.jsonl');
