/**
 * node scripts/fetch-salas.js
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

  const data = await fetch(`${BASE_URL}/empresas/${COD_EMPRESA}/salas`, {
    headers: { Authorization: `JWT ${token}` },
  }).then(r => r.json());

  const output = path.join(__dirname, '..', 'base', 'salas.json');
  fs.writeFileSync(output, JSON.stringify(data?.data ?? data, null, 2));
  console.log(`✅ Salas salvas em ${output}`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
