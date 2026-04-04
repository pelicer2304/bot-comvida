/**
 * Teste completo dos endpoints da API ClinicWeb — Produção
 * node test-endpoints.js
 */

const BASE_URL = 'https://clinicweb-api.prod.clinicweb.linx.com.br';
const USERNAME  = 'FelipeRamos';
const PASSWORD  = 'dev_PeopleAI1';
const COD_EMPRESA = 155;

let TOKEN = '';

async function req(method, path, body, label) {
  const h = { 'Content-Type': 'application/json' };
  if (TOKEN) h['Authorization'] = `JWT ${TOKEN}`;
  try {
    const r = await fetch(`${BASE_URL}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let j = {}; try { j = JSON.parse(text); } catch {}
    const ok = r.status < 400;
    console.log(`[${ok ? '✅' : '❌'}] ${label} → ${r.status}`);
    console.log('   ' + JSON.stringify(j).slice(0, 200));
    return { ok, status: r.status, data: j };
  } catch (e) {
    console.log(`[💥] ${label} → ${e.message}`);
    return { ok: false };
  }
}

function proximaData(diaSemana) { // 1=dom..7=sab
  const map = { 1:0, 2:1, 3:2, 4:3, 5:4, 6:5, 7:6 };
  const hoje = new Date();
  let diff = map[diaSemana] - hoje.getDay();
  if (diff <= 0) diff += 7;
  return new Date(hoje.getTime() + diff * 86400000).toISOString().split('T')[0];
}

async function run() {
  console.log('\n=== TESTE COMPLETO — ClinicWeb Produção ===\n');

  // ── AUTENTICAÇÃO ──────────────────────────────────────────────────────────
  console.log('--- AUTENTICAÇÃO ---');
  const auth = await req('POST', '/auth/login', { username: USERNAME, password: PASSWORD }, 'POST /auth/login');
  if (!auth.ok) return;
  TOKEN = auth.data.token;

  // ── EMPRESA ───────────────────────────────────────────────────────────────
  console.log('\n--- EMPRESA ---');
  await req('GET', `/empresas/${COD_EMPRESA}`, null, 'GET /empresas/:id');
  await req('GET', `/empresas/${COD_EMPRESA}/salas`, null, 'GET /empresas/:id/salas');
  // Salas reais: -2=Agenda Virtual, -1=Agenda Cirurgia, 0=Sala Padrão, 1330/1331=Sala Padrão
  await req('GET', `/empresas/${COD_EMPRESA}/convenios?termo=par`, null, 'GET /empresas/:id/convenios');
  // Particular: codConvenio=-1, codPlano=-2
  await req('GET', `/empresas/${COD_EMPRESA}/grupo-procedimentos`, null, 'GET /empresas/:id/grupo-procedimentos');
  // Consulta: codGrupoProcedimento=6479, codProcedimento=2767

  // ── PROFISSIONAIS ─────────────────────────────────────────────────────────
  console.log('\n--- PROFISSIONAIS ---');
  await req('GET', `/profissionais?codEmpresa=${COD_EMPRESA}&term=a`, null, 'GET /profissionais (term mín 1 char)');
  await req('GET', `/profissionais/1504717/blocos-atendimento?idEmpresa=${COD_EMPRESA}`, null,
    'GET /profissionais/:id/blocos-atendimento (idEmpresa obrigatório)');
  // diaSemana: 1=dom, 2=seg, 3=ter, 4=qua, 5=qui, 6=sex, 7=sab
  await req('GET', `/profissionais/1504717/encaixes?idEmpresa=${COD_EMPRESA}&data=${proximaData(6)}`, null,
    'GET /profissionais/:id/encaixes (idEmpresa + data obrigatórios)');
  await req('GET', `/profissionais/1504717/especialidades?idEmpresa=${COD_EMPRESA}`, null,
    'GET /profissionais/:id/especialidades?idEmpresa= (idEmpresa obrigatório)');
  // Resposta: data[{ idProfEsp, prof_reg, codesp, Especialidade: { descri } }]

  // ── AGENDAMENTOS ──────────────────────────────────────────────────────────
  console.log('\n--- AGENDAMENTOS ---');
  const hoje = new Date().toISOString().split('T')[0];
  const em7  = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  // Horários livres: buscar por dia exato do bloco, range máx 30 dias
  const diaLivre = proximaData(2); // segunda-feira
  const diaLivreFim = new Date(new Date(diaLivre).getTime() + 86400000).toISOString().split('T')[0];
  await req('GET',
    `/agendamentos/livres?codEmpresa=${COD_EMPRESA}&codProfissional=1504717&data=${diaLivre}&dataFim=${diaLivreFim}`,
    null, 'GET /agendamentos/livres');
  // Resposta: data.horariosLivres[{ data, hora, diaSemana, intervalo, horaFim }]

  await req('GET',
    `/agendamentos?codEmpresa=${COD_EMPRESA}&startDate=${hoje}&endDate=${em7}&codProfissionais[]=1504717`,
    null, 'GET /agendamentos (codProfissionais[] como array)');

  await req('GET', `/agendamentos/bloqueados?codEmpresa=${COD_EMPRESA}&codProfissional=1504717&data=${hoje}`, null,
    'GET /agendamentos/bloqueados');

  await req('GET', '/agendamento-status', null, 'GET /agendamento-status');
  // 0=Cancelado, 1=Aguarda, 2=Confirmado, 3=Não chegou, 9=...

  // Criar agendamento (codPaciente = idPaciente do GET /pacientes, NÃO idUsuario)
  const dataFutura = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
  const criado = await req('POST', '/agendamentos', {
    codEmpresa:     COD_EMPRESA,
    codPaciente:    271372367,  // idPaciente (campo idPaciente do GET /pacientes)
    codProfissional: 1504717,
    data:           dataFutura,
    hora:           '16:50',
    intervalo:      10,
    codProcedimento: 51324,
    codStatus:      2,
    codSala:        0,          // OBRIGATÓRIO
    codConvenio:    -1,
    codPlano:       -2,
  }, 'POST /agendamentos (codSala obrigatório, codPaciente=idPaciente)');

  const codAg = criado.data?.data?.codAgendamento;
  if (codAg) {
    await req('GET', `/agendamentos/${codAg}?codEmpresa=${COD_EMPRESA}`, null, 'GET /agendamentos/:id');

    await req('PATCH', `/agendamentos/${codAg}`, {
      idEmpresa:   COD_EMPRESA,
      agendamento: { idStatus: 1 }  // body: { idEmpresa, agendamento: { idStatus } }
    }, 'PATCH /agendamentos/:id');

    await req('DELETE', `/agendamentos/${codAg}?codProfissional=1504717&codEmpresa=${COD_EMPRESA}`, null,
      'DELETE /agendamentos/:id (codEmpresa + codProfissional obrigatórios)');
  }

  // ── PACIENTES ─────────────────────────────────────────────────────────────
  console.log('\n--- PACIENTES ---');
  await req('GET', `/pacientes?codEmpresa=${COD_EMPRESA}&query=42023779820`, null, 'GET /pacientes (busca por CPF)');
  // Resposta: data[{ idUsuario, idPaciente, nome, ... }]
  // codPaciente no POST /agendamentos = idPaciente

  // Convênios do paciente na empresa (usa idPaciente, não idUsuario)
  await req('GET', `/empresas/${COD_EMPRESA}/paciente/55874146/convenios`, null,
    'GET /empresas/:id/paciente/:idPaciente/convenios (idPaciente obrigatório, não idUsuario)');
  // Retorna convênios vinculados ao paciente — útil para pré-selecionar convênio no agendamento

  await req('POST', '/pacientes', {
    codEmpresa:      COD_EMPRESA,
    nomeCompleto:    'PACIENTE TESTE BOT 2',  // campo é nomeCompleto, não nome
    cpf:             '000.000.000-00',
    dataNascimento:  '1990-01-01',
    sexo:            'M',
    email:           'bot2@teste.com',
    dddCelular:      '11',
    telCelular:      '999999999',
  }, 'POST /pacientes (nomeCompleto obrigatório, não nome)');

  console.log('\n=== MAPA FINAL DOS CONTRATOS ===');
  console.log('POST /auth/login                    → { username, password }');
  console.log('GET  /profissionais                 → ?codEmpresa=&term= (term mín 1 char)');
  console.log('GET  /profissionais/:id/blocos-atendimento → ?idEmpresa= (não codEmpresa!)');
  console.log('GET  /profissionais/:id/encaixes    → ?idEmpresa=&data=');
  console.log('GET  /agendamentos/livres           → ?codEmpresa=&codProfissional=&data=&dataFim= (range máx 30d)');
  console.log('     resposta: data.horariosLivres[{ data, hora, diaSemana, intervalo, horaFim }]');
  console.log('GET  /agendamentos                  → ?codProfissionais[]= (array!)');
  console.log('GET  /agendamentos/:id              → ?codEmpresa=');
  console.log('POST /agendamentos                  → codSala obrigatório; codPaciente = idPaciente');
  console.log('PATCH /agendamentos/:id             → { idEmpresa, agendamento: { idStatus } }');
  console.log('DELETE /agendamentos/:id            → ?codEmpresa=&codProfissional=');
  console.log('GET  /empresas/:id/salas            → salas: -2, -1, 0, 1330, 1331');
  console.log('GET  /profissionais/:id/especialidades → ?idEmpresa= → Especialidade.descri');
  console.log('GET  /empresas/:id/paciente/:idPaciente/convenios → usa idPaciente (não idUsuario)');
  console.log('POST /pacientes                     → campo é nomeCompleto (não nome)');
  console.log('GET  /pacientes                     → ?codEmpresa=&query= → idPaciente para usar no POST agendamento');
}

run();
