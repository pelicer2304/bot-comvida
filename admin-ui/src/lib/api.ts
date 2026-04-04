const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("admin_token") ?? "";
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    if (typeof window !== "undefined" && !window.location.pathname.includes("/sign-in")) {
      localStorage.removeItem("admin_token");
      window.location.href = "/pt/authentication/sign-in/";
    }
    throw new Error("Não autorizado");
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    apiFetch<{ token: string }>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  getSessions: () => apiFetch<SessionSummary[]>("/admin/sessions"),
  getSession: (id: string) => apiFetch<SessionDetail>(`/admin/sessions/${id}`),
  getSessionMessages: (id: string) => apiFetch<LogEntry[]>(`/admin/sessions/${id}/messages`),
  deleteSession: (id: string) => apiFetch(`/admin/sessions/${id}`, { method: "DELETE" }),
  getEscaladas: () => apiFetch<SessionSummary[]>("/admin/sessions/escaladas"),
  assumirAtendimento: (id: string) => apiFetch(`/admin/sessions/${encodeURIComponent(id)}/assumir`, { method: "POST" }),
  exportSessionCsv: (id: string) => `${BASE}/admin/sessions/${encodeURIComponent(id)}/export?token=${getToken()}`,

  getMetrics: (periodo: "hoje" | "semana" | "mes") =>
    apiFetch<Metrics>(`/admin/metrics?periodo=${periodo}`),

  getConfig: () => apiFetch<BotConfig>("/admin/config"),
  patchConfig: (data: Partial<BotConfig>) =>
    apiFetch<BotConfig>("/admin/config", { method: "PATCH", body: JSON.stringify(data) }),

  getAgendamentos: (data: string, idProfissional?: number) =>
    apiFetch<Agendamento[]>(
      `/admin/agendamentos?data=${data}${idProfissional ? `&idProfissional=${idProfissional}` : ""}`
    ),
  patchAgendamentoStatus: (cod: number, idStatus: number) =>
    apiFetch(`/admin/agendamentos/${cod}/status`, {
      method: "PATCH",
      body: JSON.stringify({ idStatus }),
    }),

  getConvenios: () => apiFetch<Convenio[]>("/admin/convenios"),
  getConvenio: (cod: number) => apiFetch<Convenio>(`/admin/convenios/${cod}`),
  patchConvenio: (cod: number, observacao: string) =>
    apiFetch(`/admin/convenios/${cod}`, {
      method: "PATCH",
      body: JSON.stringify({ observacao }),
    }),
  syncConvenios: () => apiFetch("/admin/convenios/sync", { method: "POST" }),

  getPacientes: (query: string) =>
    apiFetch<Paciente[]>(`/admin/pacientes?query=${encodeURIComponent(query)}`),
  getPaciente: (id: number) => apiFetch<PacienteDetail>(`/admin/pacientes/${id}`),

  getProfissionais: () => apiFetch<{ idUsuario: number; nome: string; especialidades: string[] }[]>("/admin/profissionais"),
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SessionSummary {
  threadId: string;
  step: string;
  pacienteNome?: string;
  lastActivityAt: string;
  tentativasTotal: number;
  agendamentoId?: number;
}

export interface SessionDetail extends SessionSummary {
  paciente?: { idPaciente: number; nome: string; dataNascimento: string };
  convenio?: { codConvenio: number; codPlano: number; nome: string };
  especialidade?: { nome: string };
  horario?: { data: string; hora: string };
}

export interface LogEntry {
  ts: string;
  role: "user" | "bot";
  message: string;
}

export interface Metrics {
  totalConversas: number;
  agendamentosConcluidos: number;
  taxaConclusao: number;
  escalamentos: number;
  stepMaisAbandonado: string;
  tempoMedioMinutos: number;
}

export interface BotConfig {
  botAtivo: boolean;
  mensagemBoasVindas: string;
  mensagemForaHorario: string;
  maxTentativasPorStep: number;
  debounceMs: number;
  horarioAtendimento: Record<string, { ativo: boolean; inicio: string; fim: string }>;
}

export interface Agendamento {
  codAgendamento: number;
  data: string;
  hora: string;
  pacienteNome: string;
  convenioNome: string;
  profissionalNome: string;
  especialidade: string;
  procedimento: string;
  status: number;
  statusDescricao: string;
  criadoPeloBot: boolean;
}

export interface Convenio {
  codConvenio: number;
  descricaoConvenio: string;
  codANS: string;
  planos: { codPlano: number; plano: string }[];
  observacao: string;
}

export interface Paciente {
  idPaciente: number;
  nome: string;
  cpf: string;
  dataNascimento: string;
  sessaoAtiva?: { threadId: string; step: string };
}

export interface PacienteDetail extends Paciente {
  convenios: { codConvenio: number; descricaoConvenio: string }[];
  agendamentos: Agendamento[];
}
