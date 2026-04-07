import { config } from '../config';

const { url: BASE_URL, codEmpresa: COD_EMPRESA, username, password } = config.clinicweb;

// ── Auth cache ────────────────────────────────────────────────────────────────
let _token: string | null = null;
let _tokenExpiresAt = 0;

function parseTokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.exp * 1000;
  } catch {
    return Date.now() + 20 * 60 * 1000;
  }
}

async function getToken(): Promise<string> {
  const margin = 5 * 60 * 1000;
  if (_token && Date.now() < _tokenExpiresAt - margin) return _token;

  const r = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error(`Falha no login ClinicWeb: ${r.status}`);
  const data = await r.json() as { token: string };
  _token = data.token;
  _tokenExpiresAt = parseTokenExpiry(_token);
  return _token;
}

// ── HTTP com retry para 5xx ───────────────────────────────────────────────────
async function call<T = unknown>(method: string, path: string, body?: unknown, attempt = 1, timeoutMs = 15000): Promise<T> {
  const token = await getToken();
  const r = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await r.text();
  let json: Record<string, unknown>;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (r.status >= 500 && attempt < 2) {
    await new Promise(res => setTimeout(res, 1000));
    return call(method, path, body, attempt + 1, timeoutMs);
  }

  if (!r.ok) {
    const errors = json?.errors as Array<{ messages: string[] }> | undefined;
    const msg = (json?.error as string) || errors?.[0]?.messages?.[0] || `HTTP ${r.status}`;
    throw new Error(msg);
  }

  return ((json as Record<string, unknown>)?.data ?? json) as T;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function assertDate(val: string, name: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) throw new Error(`${name} deve estar no formato YYYY-MM-DD`);
}
function assertHora(val: string, name: string) {
  if (!/^\d{2}:\d{2}$/.test(val)) throw new Error(`${name} deve estar no formato HH:MM`);
}
function addDays(date: string, n: number): string {
  return new Date(new Date(date).getTime() + n * 86400000).toISOString().split('T')[0];
}
function nextDate(diaSemana: number): string {
  const map: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 };
  const hoje = new Date();
  let diff = map[diaSemana] - hoje.getDay();
  if (diff <= 0) diff += 7;
  return new Date(hoje.getTime() + diff * 86400000).toISOString().split('T')[0];
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Paciente {
  idPaciente: number;
  nome: string;
  dataNascimento: string;
}

export interface HorarioLivre {
  data: string;
  hora: string;
  intervalo: number;
}

// ── API ───────────────────────────────────────────────────────────────────────
export const cw = {
  async buscarPacientes(cpf: string): Promise<Paciente[]> {
    if (!cpf || cpf.length < 3) throw new Error('CPF deve ter ao menos 3 caracteres');
    console.log(`[cw] buscarPacientes: ${cpf}`);
    const result = await call<Paciente[]>('GET', `/pacientes?codEmpresa=${COD_EMPRESA}&query=${encodeURIComponent(cpf)}`, null, 1, 10000);
    console.log(`[cw] buscarPacientes: ${Array.isArray(result) ? result.length : 0} resultados`);
    return result;
  },

  async criarPaciente(args: { nomeCompleto: string; cpf: string; dataNascimento: string; sexo: 'M' | 'F' }): Promise<Paciente> {
    assertDate(args.dataNascimento, 'dataNascimento');
    console.log(`[cw] criarPaciente: ${args.nomeCompleto}`);
    return call('POST', '/pacientes', { codEmpresa: COD_EMPRESA, ...args, sexo: args.sexo.toUpperCase() });
  },

  async blocosProfissional(idProfissional: number) {
    return call<Array<{ diaSemana: number }>>('GET', `/profissionais/${idProfissional}/blocos-atendimento?idEmpresa=${COD_EMPRESA}`);
  },

  async horariosLivres(idProfissional: number, data: string, dataFim?: string): Promise<HorarioLivre[]> {
    assertDate(data, 'data');
    const fim = dataFim || addDays(data, 1);
    const result = await call<{ horariosLivres?: HorarioLivre[] } | HorarioLivre[]>(
      'GET', `/agendamentos/livres?codEmpresa=${COD_EMPRESA}&codProfissional=${idProfissional}&data=${data}&dataFim=${fim}`
    );
    return (result as { horariosLivres?: HorarioLivre[] })?.horariosLivres ?? (result as HorarioLivre[]);
  },

  async proximosHorariosLivres(idProfissional: number, diasParaFrente = 14): Promise<HorarioLivre[]> {
    const blocos = await cw.blocosProfissional(idProfissional);
    const lista = Array.isArray(blocos) ? blocos : [];
    const diasSemana = [...new Set(lista.map(b => b.diaSemana))];
    if (!diasSemana.length) throw new Error('Profissional sem agenda configurada');

    const encontrados: HorarioLivre[] = [];
    for (const dia of diasSemana) {
      let data = nextDate(dia);
      for (let i = 0; i < Math.ceil(diasParaFrente / 7); i++) {
        try {
          const horarios = await cw.horariosLivres(idProfissional, data, addDays(data, 1));
          if (horarios?.length) encontrados.push(...horarios);
        } catch { /* sem agenda nesse dia */ }
        data = addDays(data, 7);
      }
    }
    return encontrados.sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));
  },

  async criarAgendamento(args: {
    codPaciente: number; codProfissional: number; data: string; hora: string;
    intervalo?: number; codProcedimento: number; codConvenio?: number; codPlano?: number;
  }) {
    assertDate(args.data, 'data');
    assertHora(args.hora, 'hora');

    const livres = await cw.horariosLivres(args.codProfissional, args.data, addDays(args.data, 1));
    const slot = livres?.find(h => h.hora === args.hora);
    if (!slot) throw new Error(`Horário ${args.hora} em ${args.data} não está mais disponível.`);

    return call('POST', '/agendamentos', {
      codEmpresa: COD_EMPRESA,
      codPaciente: args.codPaciente,
      codProfissional: args.codProfissional,
      data: args.data,
      hora: args.hora,
      intervalo: slot.intervalo ?? args.intervalo ?? 30,
      codProcedimento: args.codProcedimento,
      codStatus: 2,
      codSala: 0,
      codConvenio: args.codConvenio ?? -1,
      codPlano: args.codPlano ?? -2,
    });
  },
};
