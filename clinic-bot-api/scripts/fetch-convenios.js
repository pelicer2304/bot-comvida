/**
 * Busca todos os convênios da empresa e salva em convenios.json
 * node scripts/fetch-convenios.js
 */

const fs = require('fs');
const path = require('path');

const BASE_URL  = process.env.API_URL   || 'https://clinicweb-api.prod.clinicweb.linx.com.br';
const USERNAME  = process.env.CW_USERNAME || 'FelipeRamos';
const PASSWORD  = process.env.CW_PASSWORD || 'FelipeRamos152@';
const COD_EMPRESA = process.env.COD_EMPRESA || 155;

async function run() {
  // 1. Autenticar
  const authRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  const { token } = await authRes.json();
  if (!token) throw new Error('Falha na autenticação');

  // 2. Buscar convênios (sem termo = todos)
  const res = await fetch(`${BASE_URL}/empresas/${COD_EMPRESA}/convenios`, {
    headers: { Authorization: `JWT ${token}` },
  });
  const data = await res.json();

  // 3. Filtrar campos
  const lista = data?.data ?? data;
  const convenios = lista.map(c => ({
    codConvenio: c.codConvenio,
    codANS: c.codANS,
    descricaoConvenio: c.descricaoConvenio,
    razaoSocial: c.razaoSocial,
    planos: (c.planos ?? []).map(p => ({ codPlano: p.codPlano, plano: p.plano })),
    observacao: c.ConvenioComplemento?.[0]?.Observacoes ?? null,
  }));

  // 4. Salvar arquivo
  const output = path.join(__dirname, '..', 'base', 'convenios.json');
  fs.writeFileSync(output, JSON.stringify(convenios, null, 2));
  console.log(`✅ Convênios salvos em ${output}`);
  console.log(`   Total: ${convenios.length} registros`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
