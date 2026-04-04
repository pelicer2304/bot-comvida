export interface SessionState {
  phone: string;
  step: Step;
  paciente?: { idPaciente: number; nome: string; cpf: string; dataNascimento: string };
  convenio?: { codConvenio: number; codPlano: number; nome: string };
  especialidade?: { nome: string; idProfissional: number; idsProfissionais: number[] };
  horario?: { data: string; hora: string; intervalo: number; codProcedimento: number };
  agendamentoId?: number;
  tentativas: Record<string, number>;
  subStep?: string;
  tempData?: Record<string, unknown>;
  lastActivityAt: string;
  createdAt: string;
}

export type Step =
  | 'saudacao'
  | 'identificacao'
  | 'convenio'
  | 'especialidade'
  | 'horarios'
  | 'confirmacao'
  | 'concluido'
  | 'escalado';

export type BotResponse =
  | { type: 'text'; text: string }
  | { type: 'buttons'; text: string; buttons: { id: string; label: string }[] }
  | { type: 'list'; text: string; buttonLabel: string; sections: { title: string; rows: { id: string; title: string; description?: string }[] }[] };

export interface StepResult {
  responses: BotResponse[];
  stateUpdate: Partial<SessionState>;
}

export type StepHandler = (session: SessionState, input: string) => Promise<StepResult>;
