// clinicweb.js — wrapper da API ClinicWeb com auth cache + retry

const BASE_URL = process.env.CW_API_URL || 'https://clinicweb-api.prod.clinicweb.linx.com.br';
const COD_EMPRESA = Number(process.env.COD_EMPRESA || 155);

// ── Auth cache ────────────────────────────────────────────────────────────────
let _token = null;
let _tokenExpiresAt = 0;

function parseTokenExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.exp * 1000; // ms
  } catch {
    return Date.now() + 20 * 60 * 1000; // fallback 20min
  }
}

async function getToken() {
  const margin = 5 * 60 * 1000; // renova 5min antes de expirar
  if (_token && Date.now() < _tokenExpiresAt - margin) return _token;

  const r = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.CW_USERNAME,
      password: process.env.CW_PASSWORD,
    }),
  });
  if (!r.ok) throw new Error(`Falha no login ClinicWeb: ${r.status}`);
  const data = await r.json();
  _token = data.token;
  _tokenExpiresAt = parseTokenExpiry(_token);
  return _token;
}

// ── HTTP com retry para 5xx ───────────────────────────────────────────────────
async function call(method, path, body, attempt = 1, timeoutMs = 15000) {
  const token = await getToken();
  const r = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  // Retry apenas em 5xx
  if (r.status >= 500 && attempt <= 3) {
    await new Promise(res => setTimeout(res, attempt * 1000));
    return call(method, path, body, attempt + 1, timeoutMs);
  }

  if (!r.ok) {
    const msg = json?.error || json?.errors?.[0]?.messages?.[0] || `HTTP ${r.status}`;
    throw new Error(msg);
  }

  return json?.data ?? json;
}

// ── Helpers de validação ──────────────────────────────────────────────────────
function assertDate(val, name) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val))
    throw new Error(`${name} deve estar no formato YYYY-MM-DD`);
}
function assertHora(val, name) {
  if (!/^\d{2}:\d{2}$/.test(val))
    throw new Error(`${name} deve estar no formato HH:MM`);
}
function nextDate(diaSemana) { // 1=dom..7=sab → próxima data
  const map = { 1:0, 2:1, 3:2, 4:3, 5:4, 6:5, 7:6 };
  const hoje = new Date();
  let diff = map[diaSemana] - hoje.getDay();
  if (diff <= 0) diff += 7;
  return new Date(hoje.getTime() + diff * 86400000).toISOString().split('T')[0];
}
function addDays(date, n) {
  return new Date(new Date(date).getTime() + n * 86400000).toISOString().split('T')[0];
}

// ── API methods ───────────────────────────────────────────────────────────────
export const cw = {
  COD_EMPRESA,

  // Profissionais
  async listarProfissionais(term = 'a') {
    if (!term || term.length < 1) throw new Error('term deve ter ao menos 1 caractere');
    return call('GET', `/profissionais?codEmpresa=${COD_EMPRESA}&term=${encodeURIComponent(term)}`);
  },

  async especialidadesProfissional(idProfissional) {
    return call('GET', `/profissionais/${idProfissional}/especialidades?idEmpresa=${COD_EMPRESA}`);
  },

  async blocosProfissional(idProfissional) {
    return call('GET', `/profissionais/${idProfissional}/blocos-atendimento?idEmpresa=${COD_EMPRESA}`);
  },

  async encaixesProfissional(idProfissional, data) {
    assertDate(data, 'data');
    return call('GET', `/profissionais/${idProfissional}/encaixes?idEmpresa=${COD_EMPRESA}&data=${data}`);
  },

  // Agendamentos
  async horariosLivres(idProfissional, data, dataFim) {
    assertDate(data, 'data');
    const fim = dataFim || addDays(data, 1);
    assertDate(fim, 'dataFim');
    const diff = (new Date(fim) - new Date(data)) / 86400000;
    if (diff > 30) throw new Error('Intervalo máximo é 30 dias');
    const result = await call('GET',
      `/agendamentos/livres?codEmpresa=${COD_EMPRESA}&codProfissional=${idProfissional}&data=${data}&dataFim=${fim}`
    );
    return result?.horariosLivres ?? result;
  },

  // Busca horários livres varrendo os dias configurados nos blocos do profissional
  async proximosHorariosLivres(idProfissional, diasParaFrente = 14) {
    const blocos = await cw.blocosProfissional(idProfissional);
    const lista = Array.isArray(blocos) ? blocos : blocos?.data ?? [];
    const diasSemana = [...new Set(lista.map(b => b.diaSemana))];
    if (!diasSemana.length) throw new Error('Profissional sem agenda configurada');

    const encontrados = [];
    for (const dia of diasSemana) {
      let data = nextDate(dia);
      for (let i = 0; i < Math.ceil(diasParaFrente / 7); i++) {
        const fim = addDays(data, 1);
        try {
          const horarios = await cw.horariosLivres(idProfissional, data, fim);
          if (horarios?.length) encontrados.push(...horarios);
        } catch { /* sem agenda nesse dia */ }
        data = addDays(data, 7);
      }
    }
    return encontrados.sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));
  },

  async listarAgendamentos(idProfissional, startDate, endDate) {
    assertDate(startDate, 'startDate');
    assertDate(endDate, 'endDate');
    return call('GET',
      `/agendamentos?codEmpresa=${COD_EMPRESA}&startDate=${startDate}&endDate=${endDate}&codProfissionais[]=${idProfissional}`
    );
  },

  async buscarAgendamento(codAgendamento) {
    return call('GET', `/agendamentos/${codAgendamento}?codEmpresa=${COD_EMPRESA}`);
  },

  async criarAgendamento({ codPaciente, codProfissional, data, hora, intervalo, codProcedimento, codStatus = 2, codSala = 0, codConvenio = -1, codPlano = -2, observacoes }) {
    assertDate(data, 'data');
    assertHora(hora, 'hora');
    if (!codPaciente) throw new Error('codPaciente é obrigatório (use idPaciente do GET /pacientes)');
    if (!codProfissional) throw new Error('codProfissional é obrigatório');
    if (!codProcedimento) throw new Error('codProcedimento é obrigatório');

    // Verificação prévia: confirma que o horário ainda está livre e pega intervalo real
    const livres = await cw.horariosLivres(codProfissional, data, addDays(data, 1));
    const slot = livres?.find(h => h.hora === hora);
    if (!slot) throw new Error(`Horário ${hora} em ${data} não está mais disponível. Busque novos horários.`);

    return call('POST', '/agendamentos', {
      codEmpresa: COD_EMPRESA,
      codPaciente,
      codProfissional,
      data,
      hora,
      intervalo: slot.intervalo ?? intervalo ?? 30,
      codProcedimento,
      codStatus,
      codSala,
      codConvenio,
      codPlano,
      ...(observacoes && { observacoes }),
    });
  },

  async alterarStatusAgendamento(codAgendamento, idStatus) {
    if (![0, 1, 2, 3].includes(idStatus))
      throw new Error('idStatus inválido. Use: 0=Cancelado, 1=Aguarda, 2=Confirmado, 3=Não chegou');
    return call('PATCH', `/agendamentos/${codAgendamento}`, {
      idEmpresa: COD_EMPRESA,
      agendamento: { idStatus },
    });
  },

  async cancelarAgendamento(codAgendamento, codProfissional) {
    if (!codProfissional) throw new Error('codProfissional é obrigatório para cancelar');
    return call('DELETE', `/agendamentos/${codAgendamento}?codEmpresa=${COD_EMPRESA}&codProfissional=${codProfissional}`);
  },

  async diasBloqueados(idProfissional, data) {
    assertDate(data, 'data');
    return call('GET', `/agendamentos/bloqueados?codEmpresa=${COD_EMPRESA}&codProfissional=${idProfissional}&data=${data}`);
  },

  async listarStatus() {
    return call('GET', '/agendamento-status');
  },

  // Pacientes
  async buscarPacientes(query) {
    if (!query || query.length < 3) throw new Error('query deve ter ao menos 3 caracteres (CPF)');
    // /pacientes tem timeout 504 frequente — usa timeout maior e mais retries
    return call('GET', `/pacientes?codEmpresa=${COD_EMPRESA}&query=${encodeURIComponent(query)}`, null, 1, 25000);
  },

  async criarPaciente({ nomeCompleto, cpf, dataNascimento, sexo, email, dddCelular, telCelular }) {
    if (!nomeCompleto) throw new Error('nomeCompleto é obrigatório');
    if (!dataNascimento) throw new Error('dataNascimento é obrigatório (YYYY-MM-DD)');
    if (!['M', 'F', 'I'].includes(sexo?.toUpperCase()))
      throw new Error('sexo deve ser M, F ou I');
    assertDate(dataNascimento, 'dataNascimento');
    return call('POST', '/pacientes', {
      codEmpresa: COD_EMPRESA,
      nomeCompleto,
      cpf,
      dataNascimento,
      sexo: sexo.toUpperCase(),
      email,
      dddCelular,
      telCelular,
    });
  },

  async conveniosPaciente(idPaciente) {
    return call('GET', `/empresas/${COD_EMPRESA}/paciente/${idPaciente}/convenios`);
  },

  // Empresa
  async listarConvenios(termo = '') {
    return call('GET', `/empresas/${COD_EMPRESA}/convenios${termo ? `?termo=${encodeURIComponent(termo)}` : ''}`);
  },

  async listarProcedimentos() {
    return call('GET', `/empresas/${COD_EMPRESA}/grupo-procedimentos`);
  },

  async listarSalas() {
    return call('GET', `/empresas/${COD_EMPRESA}/salas`);
  },
};
