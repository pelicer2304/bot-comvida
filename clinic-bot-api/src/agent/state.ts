import { Annotation, messagesStateReducer } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';

export const BookingStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer }),

  step: Annotation<
    'identificacao' | 'convenio' | 'especialidade' | 'horarios' | 'confirmacao' | 'concluido' | 'escalado' | 'resetado'
  >({ reducer: (_, v) => v, default: () => 'identificacao' }),

  paciente: Annotation<{ idPaciente: number; nome: string; dataNascimento: string } | undefined>({
    reducer: (_, v) => v,
    default: () => undefined,
  }),

  convenio: Annotation<{ codConvenio: number; codPlano: number; nome: string } | undefined>({
    reducer: (_, v) => v,
    default: () => undefined,
  }),

  especialidade: Annotation<{ nome: string; idProfissional: number; idsProfissionais: number[] } | undefined>({
    reducer: (_, v) => v,
    default: () => undefined,
  }),

  horario: Annotation<
    { data: string; hora: string; intervalo: number; codProcedimento: number } | undefined
  >({
    reducer: (_, v) => v,
    default: () => undefined,
  }),

  pacientePendente: Annotation<{ idPaciente: number; nome: string; dataNascimento: string } | undefined>({
    reducer: (_, v) => v,
    default: () => undefined,
  }),

  cadastroPendente: Annotation<{ nome: string; cpf: string; dataNascimento?: string; sexo?: 'M' | 'F' | 'I' } | undefined>({
    reducer: (_, v) => v,
    default: () => undefined,
  }),

  aguardandoCadastro: Annotation<boolean>({
    reducer: (_, v) => v,
    default: () => false,
  }),

  agendamentoId: Annotation<number | undefined>({
    reducer: (_, v) => v,
    default: () => undefined,
  }),

  tentativas: Annotation<Record<string, number>>({
    reducer: (cur, v) => ({ ...cur, ...v }),
    default: () => ({}),
  }),

  lastActivityAt: Annotation<string>({
    reducer: (_, v) => v,
    default: () => new Date().toISOString(),
  }),
});

export type BookingState = typeof BookingStateAnnotation.State;

export function getInitialState(): Omit<BookingState, 'messages'> & { messages: BaseMessage[] } {
  return {
    messages: [],
    step: 'identificacao',
    paciente: undefined,
    convenio: undefined,
    especialidade: undefined,
    horario: undefined,
    pacientePendente: undefined,
    cadastroPendente: undefined,
    agendamentoId: undefined,
    tentativas: {},
    lastActivityAt: new Date().toISOString(),
  };
}
