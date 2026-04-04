// test-convenio.js — simula conversa a partir do step=convenio
// Uso: node scripts/test-convenio.js [1|2|3|4|all]
import 'dotenv/config';

const BASE_URL = `http://localhost:${process.env.PORT ?? 3002}`;
const PHONE = '5511954502967@s.whatsapp.net';

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

// Chega ao step=convenio com paciente existente
async function setupAtConvenio() {
  await clearThread();
  await send('Oi, quero agendar');
  await send('Lucas Travagin', 8000);
  await send('42023779820', 12000);
  await send('Sim', 6000); // confirma identidade → step=convenio
}

function log(label, msg) {
  console.log(`\n[${label}] ${msg}`);
}

// ── Cenário 1: Particular ─────────────────────────────────────────────────────
async function cenario1() {
  log('CENÁRIO 1', 'Atendimento particular');
  await setupAtConvenio();
  await send('não tenho convênio, vou pagar particular', 12000);
  log('CENÁRIO 1', 'Esperado: step=especialidade, convenio={codConvenio:-1, codPlano:-2, nome:"Particular"}');
}

// ── Cenário 1b: Particular — só diz "não tenho convênio" ───────────────────────
async function cenario1b() {
  log('CENÁRIO 1b', 'Só diz "não tenho convênio" sem mencionar particular');
  await setupAtConvenio();
  await send('não tenho convênio', 12000);
  log('CENÁRIO 1b', 'Esperado: step=especialidade, convenio={codConvenio:-1, codPlano:-2, nome:"Particular"}');
}

// ── Cenário 2: Convênio com 1 plano (auto-seleciona) ─────────────────────────
async function cenario2() {
  log('CENÁRIO 2', 'CLINESP — 1 plano (auto-seleção)');
  await setupAtConvenio();
  await send('CLINESP', 8000);
  log('CENÁRIO 2', 'Esperado: step=especialidade, convenio={codConvenio:9097, codPlano:34350, nome:"CLINESP PLANOS DE SAÚDE"}');
}

// ── Cenário 2b: Convênio com 1 plano — IAMSPE (auto-seleciona) ──────────────
async function cenario2b() {
  log('CENÁRIO 2b', 'IAMSPE — 1 plano (auto-seleção, sem loop)');
  await setupAtConvenio();
  await send('iamspe', 8000);
  log('CENÁRIO 2b', 'Esperado: step=especialidade, convenio={codConvenio:10835, codPlano:68024, nome:"IAMSPE"}');
}

// ── Cenário 2c: Pergunta sobre quais convênios são aceitos ────────────────
async function cenario2c() {
  log('CENÁRIO 2c', 'Pergunta "quais convênios vocês possuem?"');
  await setupAtConvenio();
  await send('quais os convenios vcs possuem?', 8000);
  await send('iamspe', 8000); // após orientação, informa o convênio
  log('CENÁRIO 2c', 'Esperado: bot orienta sem tratar como convênio, depois step=especialidade com IAMSPE');
}

// ── Cenário 3: Convênio com múltiplos planos ──────────────────────────────────
async function cenario3() {
  log('CENÁRIO 3', 'Saúde Caixa — múltiplos planos, escolhe plano 1');
  await setupAtConvenio();
  await send('Saúde Caixa', 8000);   // lista planos: 1.Padrão  2.PCMSO
  await send('1');                    // seleciona Padrão
  log('CENÁRIO 3', 'Esperado: step=especialidade, convenio={codConvenio:222, codPlano:57, nome:"Saúde Caixa"}');
}

// ── Cenário 4: Convênio não encontrado → aceita particular ───────────────────
async function cenario4() {
  log('CENÁRIO 4', 'Convênio inexistente → aceita particular');
  await setupAtConvenio();
  await send('Plano XYZ Inexistente', 8000); // não encontrado
  await send('tudo bem, vou pagar particular');
  log('CENÁRIO 4', 'Esperado: step=especialidade, convenio={codConvenio:-1, codPlano:-2}');
}

// ── Runner ────────────────────────────────────────────────────────────────────
const cenario = process.argv[2] ?? 'all';

if (cenario === '1' || cenario === 'all') await cenario1();
if (cenario === '1b' || cenario === 'all') await cenario1b();
if (cenario === '2' || cenario === 'all') await cenario2();
if (cenario === '2b' || cenario === 'all') await cenario2b();
if (cenario === '2c' || cenario === 'all') await cenario2c();
if (cenario === '3' || cenario === 'all') await cenario3();
if (cenario === '4' || cenario === 'all') await cenario4();

console.log('\n✅ Script finalizado. Verifique os logs em logs/5511954502967_s_whatsapp_net.jsonl');
