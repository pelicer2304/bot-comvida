/**
 * node scripts/fetch-profissionais.js
 */
const fs = require('fs');
const path = require('path');

const BASE_URL    = process.env.API_URL      || 'https://clinicweb-api.prod.clinicweb.linx.com.br';
const USERNAME    = process.env.CW_USERNAME  || 'FelipeRamos';
const PASSWORD    = process.env.CW_PASSWORD  || 'FelipeRamos152@';
const COD_EMPRESA = process.env.COD_EMPRESA  || 155;

async function run() {
  const { token } = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  }).then(r => r.json());
  if (!token) throw new Error('Falha na autenticação');

  const h = { Authorization: `JWT ${token}` };

  const profData = await fetch(`${BASE_URL}/profissionais?codEmpresa=${COD_EMPRESA}&term=a`, { headers: h }).then(r => r.json());
  const lista = profData?.data ?? profData;

  // Para cada profissional, busca especialidades
  const profissionais = await Promise.all(lista.map(async p => {
    const espData = await fetch(`${BASE_URL}/profissionais/${p.idUsuario}/especialidades?idEmpresa=${COD_EMPRESA}`, { headers: h })
      .then(r => r.json()).catch(() => ({}));
    const especialidades = (espData?.data ?? []).map(e => e.Especialidade?.descri).filter(Boolean);
    return {
      idUsuario: p.idUsuario,
      nome: p.Usuario?.nome ?? p.apelido,
      especialidades,
    };
  }));

  const output = path.join(__dirname, '..', 'base', 'profissionais.json');
  fs.writeFileSync(output, JSON.stringify(profissionais, null, 2));
  console.log(`✅ Profissionais salvos em ${output}`);
  console.log(`   Total: ${profissionais.length} registros`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
