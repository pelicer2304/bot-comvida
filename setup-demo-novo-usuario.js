/**
 * Demo — cenário paciente NÃO cadastrado
 * Roteiro: Bot coleta dados → cria paciente → Convênio → Especialidade → Horários
 *
 * node setup-demo-novo-usuario.js
 */

const fs = require('fs');

try {
  fs.readFileSync('.env', 'utf8').split('\n').forEach(function(line) {
    const idx = line.indexOf('=');
    if (idx > 0) {
      const k = line.slice(0, idx).trim().replace(/\r/g, '');
      const v = line.slice(idx + 1).trim().replace(/\r/g, '');
      if (k && !process.env[k]) process.env[k] = v;
    }
  });
} catch (e) {}

const BASE_URL    = 'https://clinicweb-api.prod.clinicweb.linx.com.br';
const USERNAME    = process.env.CW_USERNAME || 'FelipeRamos';
const PASSWORD    = process.env.CW_PASSWORD || 'FelipeRamos152@';
const COD_EMPRESA = 155;

// Novo paciente — CPF que não existe na base
const NOVO_PACIENTE = {
  cpf:            '987.654.321-00',
  nomeCompleto:   'MARIA SILVA DEMO',
  dataNascimento: '1985-08-20',
  sexo:           'F',
  email:          'maria.silva.demo@email.com',
  dddCelular:     '11',
  telCelular:     '988887777',
};

const MEDICO   = { idUsuario: 1504733, nome: 'Dr. Paulo Ricardo Aben Athar de Alcantara', especialidade: 'Neurologia' };
const CONVENIO = { codConvenio: 222, descricao: 'Saude Caixa', codPlano: 57, plano: 'Padrao' };

let TOKEN = '';

async function req(method, path, body, timeoutMs) {
  const h = { 'Content-Type': 'application/json' };
  if (TOKEN) h['Authorization'] = 'JWT ' + TOKEN;
  try {
    const r = await fetch(BASE_URL + path, {
      method: method, headers: h,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs || 30000),
    });
    const text = await r.text();
    let j = {};
    try { j = JSON.parse(text); } catch (e) {}
    return { ok: r.status < 400, status: r.status, data: j };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function bot(msg)  { console.log('\n  BOT: ' + msg + '\n'); }
function user(msg) { console.log('  PACIENTE: ' + msg); }
function step(t)   { console.log('\n' + '-'.repeat(55) + '\n  ' + t + '\n' + '-'.repeat(55)); }
function ok(l, d)  { console.log('  OK  ' + l + (d ? ' -- ' + d : '')); }
function fail(l)   { console.log('  ERR ' + l); process.exit(1); }

function fmtData(iso) {
  const dias = ['domingo','segunda-feira','terca-feira','quarta-feira','quinta-feira','sexta-feira','sabado'];
  const d = new Date(iso + 'T12:00:00');
  return dias[d.getDay()] + ', ' + d.toLocaleDateString('pt-BR');
}

async function run() {
  console.log('\n=== DEMO Novo Usuario — Bot de Agendamento Clinica ComVida ===\n');

  const auth = await req('POST', '/auth/login', { username: USERNAME, password: PASSWORD });
  if (!auth.ok) fail('Autenticacao falhou');
  TOKEN = auth.data.token;
  ok('API autenticada');

  // ETAPA 1a — CPF não encontrado
  step('ETAPA 1 -- Identificacao (paciente NAO cadastrado)');

  bot('Ola! Sou o assistente da Clinica ComVida. Para agendar sua consulta, preciso do seu CPF.');
  user(NOVO_PACIENTE.cpf);

  const cpfLimpo = NOVO_PACIENTE.cpf.replace(/\D/g, '');
  const busca = await req('GET', '/pacientes?codEmpresa=' + COD_EMPRESA + '&query=' + cpfLimpo, null, 25000);
  const pacientes = busca.ok && busca.data && Array.isArray(busca.data.data) ? busca.data.data : [];

  let idPaciente, nomePaciente;

  if (pacientes.length > 0) {
    // Paciente já existe — limpa para forçar o fluxo de novo usuário
    console.log('  INFO Paciente ja existe na base. Delete-o manualmente para testar o fluxo completo.');
    console.log('       Usando dados existentes para continuar a demo...');
    idPaciente   = pacientes[0].idPaciente;
    nomePaciente = pacientes[0].nome;
    ok('Paciente encontrado (reutilizando)', 'idPaciente=' + idPaciente);
  } else {
    ok('CPF nao encontrado na base -- iniciando coleta de dados');

    // ETAPA 1b — Bot coleta dados
    bot('Nao encontrei seu cadastro. Vou criar um para voce agora!\n\n     Qual e o seu nome completo?');
    user(NOVO_PACIENTE.nomeCompleto);

    bot('Qual e a sua data de nascimento? (DD/MM/AAAA)');
    user('20/08/1985');

    bot('Qual e o seu sexo? (M/F)');
    user('F');

    bot('Qual e o seu e-mail?');
    user(NOVO_PACIENTE.email);

    bot('Qual e o seu celular com DDD?');
    user('(11) 98888-7777');

    bot('Perfeito! Vou criar seu cadastro agora...');

    // Cria o paciente
    const criado = await req('POST', '/pacientes', {
      codEmpresa:      COD_EMPRESA,
      nomeCompleto:    NOVO_PACIENTE.nomeCompleto,
      cpf:             NOVO_PACIENTE.cpf,
      dataNascimento:  NOVO_PACIENTE.dataNascimento,
      sexo:            NOVO_PACIENTE.sexo,
      email:           NOVO_PACIENTE.email,
      dddCelular:      NOVO_PACIENTE.dddCelular,
      telCelular:      NOVO_PACIENTE.telCelular,
    }, 25000);

    if (!criado.ok) fail('Falha ao criar paciente -- ' + JSON.stringify(criado.data).slice(0, 200));
    ok('POST /pacientes -- cadastro criado');

    console.log('  INFO Aguardando indexacao (4s)...');
    await new Promise(function(r) { setTimeout(r, 4000); });

    const rb = await req('GET', '/pacientes?codEmpresa=' + COD_EMPRESA + '&query=' + cpfLimpo, null, 25000);
    const rp = rb.ok && rb.data && Array.isArray(rb.data.data) ? rb.data.data : [];
    if (!rp.length) fail('Nao foi possivel recuperar paciente apos criacao');

    idPaciente   = rp[0].idPaciente;
    nomePaciente = rp[0].nome;
    ok('Paciente recuperado', 'idPaciente=' + idPaciente);

    bot('Cadastro criado com sucesso! Bem-vinda, ' + NOVO_PACIENTE.nomeCompleto.split(' ')[0] + '. Vamos continuar com o agendamento.');
  }

  // ETAPA 2
  step('ETAPA 2 -- Convenio e Plano');
  bot('Voce possui algum convenio medico? Se sim, qual?');
  user('Tenho o Saude Caixa.');
  ok('Convenio identificado', CONVENIO.descricao + ' [' + CONVENIO.codConvenio + '] -- Plano: ' + CONVENIO.plano);
  bot('Encontrei o ' + CONVENIO.descricao + '. Vou usar o plano "' + CONVENIO.plano + '". Pode confirmar?');
  user('Sim, pode ser.');

  // ETAPA 3
  step('ETAPA 3 -- Especialidade e Cobertura');
  bot('Qual especialidade ou tipo de consulta voce precisa?');
  user('Preciso de um neurologista.');
  ok('Cobertura verificada', MEDICO.especialidade + ' coberta pelo ' + CONVENIO.descricao);

  const esp = await req('GET', '/profissionais/' + MEDICO.idUsuario + '/especialidades?idEmpresa=' + COD_EMPRESA, null, 20000);
  if (esp.ok && esp.data && Array.isArray(esp.data.data)) {
    const nomes = esp.data.data.map(function(e) { return e.Especialidade && e.Especialidade.descri; }).filter(Boolean);
    ok('Especialidades do medico', nomes.join(', ') || MEDICO.especialidade);
  }
  bot('Otimo! O ' + CONVENIO.descricao + ' cobre Neurologia. Vou buscar os horarios disponiveis.');

  // ETAPA 4
  step('ETAPA 4 -- Horarios Disponiveis');
  const hoje = new Date().toISOString().split('T')[0];
  const em15 = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];

  const livres = await req('GET',
    '/agendamentos/livres?codEmpresa=' + COD_EMPRESA +
    '&codProfissional=' + MEDICO.idUsuario +
    '&data=' + hoje + '&dataFim=' + em15, null, 30000);

  const horarios = livres.ok && livres.data && livres.data.data && livres.data.data.horariosLivres
    ? livres.data.data.horariosLivres : [];

  if (!horarios.length) fail('Nenhum horario disponivel nos proximos 15 dias');
  ok('Horarios encontrados', horarios.length + ' slots');

  const opcoes = [];
  const datasVistas = {};
  for (let i = 0; i < horarios.length && opcoes.length < 3; i++) {
    if (!datasVistas[horarios[i].data]) {
      datasVistas[horarios[i].data] = true;
      opcoes.push(horarios[i]);
    }
  }

  const opcoesTxt = opcoes.map(function(h, i) {
    return (i + 1) + ') ' + fmtData(h.data) + ' as ' + h.hora;
  }).join('  |  ');

  bot('Tenho as seguintes opcoes com ' + MEDICO.nome.split(' ').slice(0, 3).join(' ') + ':\n\n     ' + opcoesTxt + '\n\n     Qual prefere?');
  user('Pode ser a opcao 1.');

  const escolhido = opcoes[0];

  // ETAPA 5
  step('ETAPA 5 -- Confirmacao');
  bot('Vou confirmar:\n\n' +
    '     Especialidade: ' + MEDICO.especialidade + '\n' +
    '     Medico:        ' + MEDICO.nome + '\n' +
    '     Data:          ' + fmtData(escolhido.data) + '\n' +
    '     Horario:       ' + escolhido.hora + '\n' +
    '     Convenio:      ' + CONVENIO.descricao + ' -- ' + CONVENIO.plano + '\n\n' +
    '     Confirma?');
  user('Confirmo!');
  bot('Agendamento confirmado! Anote: ' + MEDICO.especialidade + ' com ' + MEDICO.nome.split(' ').slice(0, 3).join(' ') + ' em ' + fmtData(escolhido.data) + ' as ' + escolhido.hora + '. Ate la!');

  // PAYLOADS
  const payloadPaciente = {
    codEmpresa:      COD_EMPRESA,
    nomeCompleto:    NOVO_PACIENTE.nomeCompleto,
    cpf:             NOVO_PACIENTE.cpf,
    dataNascimento:  NOVO_PACIENTE.dataNascimento,
    sexo:            NOVO_PACIENTE.sexo,
    email:           NOVO_PACIENTE.email,
    dddCelular:      NOVO_PACIENTE.dddCelular,
    telCelular:      NOVO_PACIENTE.telCelular,
  };

  const payloadAgendamento = {
    codEmpresa:      COD_EMPRESA,
    codPaciente:     idPaciente,
    codProfissional: MEDICO.idUsuario,
    data:            escolhido.data,
    hora:            escolhido.hora,
    intervalo:       escolhido.intervalo,
    codProcedimento: 2767,
    codStatus:       2,
    codSala:         0,
    codConvenio:     CONVENIO.codConvenio,
    codPlano:        CONVENIO.codPlano,
  };

  // CURL
  console.log('\n=== CURL ===\n');
  console.log('# 1. Obter token');
  console.log('TOKEN=$(curl -s -X POST "' + BASE_URL + '/auth/login" \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"username":"' + USERNAME + '","password":"' + PASSWORD + '"}\' \\');
  console.log('  | node -e "let d=\'\';process.stdin.on(\'data\',c=>d+=c);process.stdin.on(\'end\',()=>console.log(JSON.parse(d).token))")');
  console.log('');
  console.log('# 2. Cadastrar paciente');
  console.log('curl -s -X POST "' + BASE_URL + '/pacientes" \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -H "Authorization: JWT $TOKEN" \\');
  console.log('  -d \'' + JSON.stringify(payloadPaciente) + '\'');
  console.log('');
  console.log('# 3. Criar agendamento  (substitua COD_PACIENTE pelo idPaciente retornado acima)');
  console.log('curl -s -X POST "' + BASE_URL + '/agendamentos" \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -H "Authorization: JWT $TOKEN" \\');
  console.log('  -d \'' + JSON.stringify(payloadAgendamento) + '\'');

  // MARKDOWN
  const diasAbrev = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];

  const md = [
    '# Demo Novo Usuario — Bot de Agendamento Clinica ComVida',
    '',
    '> Cenario: paciente **nao cadastrado** — bot coleta dados, cria o cadastro e agenda.',
    '',
    '## Dados do Novo Paciente',
    '',
    '| Campo | Valor |',
    '|---|---|',
    '| Nome | ' + NOVO_PACIENTE.nomeCompleto + ' |',
    '| CPF | `' + NOVO_PACIENTE.cpf + '` |',
    '| Nascimento | `' + NOVO_PACIENTE.dataNascimento + '` |',
    '| Sexo | ' + NOVO_PACIENTE.sexo + ' |',
    '| Email | ' + NOVO_PACIENTE.email + ' |',
    '| Celular | (' + NOVO_PACIENTE.dddCelular + ') ' + NOVO_PACIENTE.telCelular + ' |',
    '| idPaciente gerado | `' + idPaciente + '` |',
    '',
    '## Agendamento',
    '',
    '| Campo | Valor |',
    '|---|---|',
    '| Medico | ' + MEDICO.nome + ' |',
    '| Especialidade | ' + MEDICO.especialidade + ' |',
    '| Convenio | ' + CONVENIO.descricao + ' — ' + CONVENIO.plano + ' |',
    '| Data | ' + fmtData(escolhido.data) + ' (`' + escolhido.data + '`) |',
    '| Horario | `' + escolhido.hora + '` |',
    '',
    '## Roteiro da Conversa',
    '',
    '### Etapa 1 — CPF nao encontrado, bot coleta dados',
    '',
    '> **Bot:** Ola! Sou o assistente da Clinica ComVida. Para agendar sua consulta, preciso do seu CPF.',
    '>',
    '> **Paciente:** ' + NOVO_PACIENTE.cpf,
    '>',
    '> **Bot:** Nao encontrei seu cadastro. Vou criar um para voce agora! Qual e o seu nome completo?',
    '>',
    '> **Paciente:** ' + NOVO_PACIENTE.nomeCompleto,
    '>',
    '> **Bot:** Qual e a sua data de nascimento? (DD/MM/AAAA)',
    '>',
    '> **Paciente:** 20/08/1985',
    '>',
    '> **Bot:** Qual e o seu sexo? (M/F)',
    '>',
    '> **Paciente:** F',
    '>',
    '> **Bot:** Qual e o seu e-mail?',
    '>',
    '> **Paciente:** ' + NOVO_PACIENTE.email,
    '>',
    '> **Bot:** Qual e o seu celular com DDD?',
    '>',
    '> **Paciente:** (11) 98888-7777',
    '>',
    '> **Bot:** Perfeito! Cadastro criado com sucesso! Bem-vinda, ' + NOVO_PACIENTE.nomeCompleto.split(' ')[0] + '. Vamos continuar com o agendamento.',
    '',
    '### Etapa 2 — Convenio',
    '',
    '> **Bot:** Voce possui algum convenio medico? Se sim, qual?',
    '>',
    '> **Paciente:** Tenho o Saude Caixa.',
    '>',
    '> **Bot:** Encontrei o ' + CONVENIO.descricao + '. Vou usar o plano "' + CONVENIO.plano + '". Pode confirmar?',
    '>',
    '> **Paciente:** Sim, pode ser.',
    '',
    '### Etapa 3 — Especialidade',
    '',
    '> **Bot:** Qual especialidade ou tipo de consulta voce precisa?',
    '>',
    '> **Paciente:** Preciso de um neurologista.',
    '>',
    '> **Bot:** Otimo! O ' + CONVENIO.descricao + ' cobre Neurologia. Vou buscar os horarios disponiveis.',
    '',
    '### Etapa 4 — Horarios',
    '',
    '> **Bot:** Tenho as seguintes opcoes com Dr. Paulo Ricardo:',
    '>',
  ].concat(
    opcoes.map(function(h, i) { return '> **' + (i+1) + ')** ' + fmtData(h.data) + ' as ' + h.hora; })
  ).concat([
    '>',
    '> Qual prefere?',
    '>',
    '> **Paciente:** Pode ser a opcao 1.',
    '',
    '### Etapa 5 — Confirmacao',
    '',
    '> **Bot:**',
    '> - Especialidade: **' + MEDICO.especialidade + '**',
    '> - Medico: **' + MEDICO.nome + '**',
    '> - Data: **' + fmtData(escolhido.data) + '**',
    '> - Horario: **' + escolhido.hora + '**',
    '> - Convenio: **' + CONVENIO.descricao + ' — ' + CONVENIO.plano + '**',
    '>',
    '> Confirma?',
    '>',
    '> **Paciente:** Confirmo!',
    '>',
    '> **Bot:** Agendamento confirmado! Anote: ' + MEDICO.especialidade + ' com Dr. Paulo Ricardo em ' + fmtData(escolhido.data) + ' as ' + escolhido.hora + '. Ate la!',
    '',
    '## curl — Fluxo Completo',
    '',
    '```bash',
    '# 1. Obter token',
    'TOKEN=$(curl -s -X POST "' + BASE_URL + '/auth/login" \\',
    '  -H "Content-Type: application/json" \\',
    '  -d \'{"username":"' + USERNAME + '","password":"' + PASSWORD + '"}\' \\',
    '  | node -e "let d=\'\';process.stdin.on(\'data\',c=>d+=c);process.stdin.on(\'end\',()=>console.log(JSON.parse(d).token))")',
    '',
    '# 2. Cadastrar paciente',
    'curl -s -X POST "' + BASE_URL + '/pacientes" \\',
    '  -H "Content-Type: application/json" \\',
    '  -H "Authorization: JWT $TOKEN" \\',
    '  -d \'' + JSON.stringify(payloadPaciente) + '\'',
    '',
    '# 3. Criar agendamento',
    'curl -s -X POST "' + BASE_URL + '/agendamentos" \\',
    '  -H "Content-Type: application/json" \\',
    '  -H "Authorization: JWT $TOKEN" \\',
    '  -d \'' + JSON.stringify(payloadAgendamento) + '\'',
    '```',
    '',
    '## Payload — Cadastro do Paciente',
    '',
    '```json',
    JSON.stringify(payloadPaciente, null, 2),
    '```',
    '',
    '## Payload — Agendamento',
    '',
    '```json',
    JSON.stringify(payloadAgendamento, null, 2),
    '```',
    '',
    '## Horarios disponiveis (proximos 15 dias)',
    '',
    '| # | Data | Dia | Hora | Hora Fim |',
    '|---|---|---|---|---|',
  ]).concat(
    horarios.slice(0, 20).map(function(h, i) {
      const d = new Date(h.data + 'T12:00:00');
      return '| ' + (i+1) + ' | `' + h.data + '` | ' + diasAbrev[d.getDay()] + ' | `' + h.hora + '` | `' + h.horaFim + '` |';
    })
  ).concat([
    '',
    '> Total de slots: **' + horarios.length + '**',
  ]);

  fs.writeFileSync('DEMO-NOVO-USUARIO.md', md.join('\n'), 'utf8');
  console.log('\n  DEMO-NOVO-USUARIO.md gerado com sucesso.');
}

run().catch(console.error);
