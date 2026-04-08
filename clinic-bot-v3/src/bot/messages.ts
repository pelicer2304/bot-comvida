import { BotResponse } from '../state/types';

// Mensagens fixas centralizadas — fácil de editar sem mexer na lógica
export const MSG = {
  saudacao: 'Olá! Sou a assistente virtual da *Clínica ComVida*.\nPara agendar sua consulta, preciso do seu *CPF*.',

  cpfInvalido: 'Não consegui identificar um CPF válido. Por favor, digite seu CPF (somente números ou no formato 000.000.000-00).',
  cpfNaoEncontrado: 'Não encontrei cadastro com esse CPF. Deseja se cadastrar?',
  cpfEscalado: 'Não consegui localizar seu cadastro. Vou transferir para um atendente que poderá te ajudar.',
  confirmarPaciente: (nome: string) => `Encontrei o cadastro de *${nome}*. É você?`,
  pacienteConfirmado: (nome: string) => `Perfeito, ${nome.split(' ')[0]}! Você possui convênio médico?`,
  cadastroNome: 'Qual seu *nome completo*?',
  cadastroNascimento: 'Qual sua *data de nascimento*? (DD/MM/AAAA)',
  cadastroSexo: 'Qual seu *sexo*?',
  cadastroSucesso: 'Cadastro realizado! Vamos agendar sua consulta.\n\nVocê possui convênio médico?',
  cadastroErro: 'Tive um problema ao realizar o cadastro. Vou transferir para um atendente.',

  convenioDigitar: 'Digite o *nome do seu convênio*.',
  convenioNaoEncontrado: (nome: string) => `Não trabalhamos com o convênio "${nome}". Deseja agendar como *particular*?`,
  convenioConfirmado: (nome: string) => `Convênio *${nome}* confirmado!`,
  convenioComPlano: (conv: string, plano: string) => `Convênio *${conv}* com plano *${plano}* confirmado!`,
  convenioEscolherPlano: (conv: string) => `Convênio *${conv}* identificado. Qual é o seu plano?`,
  convenioDigitarPlano: (conv: string) => `Convênio *${conv}* identificado. Digite o *nome do plano* como aparece na carteirinha.`,
  convenioPlanoNaoEncontrado: 'Não encontrei esse plano. Pode digitar o nome exato como aparece na carteirinha?',
  particularConfirmado: 'Atendimento *particular* confirmado!',

  especialidadeEscolher: 'Qual *especialidade* você precisa?',
  especialidadeNaoCoberta: (esp: string) => `Seu convênio não cobre *${esp}*. Deseja agendar como particular?`,
  especialidadeConfirmada: (esp: string) => `*${esp}* confirmada! Buscando horários disponíveis...`,

  horariosBuscando: (esp: string) => `Horários disponíveis para *${esp}*:`,
  horariosVazio: (esp: string) => `Não encontrei horários disponíveis para *${esp}* nos próximos 15 dias.`,
  horarioSelecionado: (desc: string) => `Horário selecionado: *${desc}*`,

  resumo: (p: string, esp: string, data: string, conv: string) =>
    `*Resumo do agendamento:*\n\nPaciente: ${p}\nEspecialidade: ${esp}\nData: ${data}\nConvênio: ${conv}\n\nConfirma o agendamento?`,
  agendamentoConfirmado: (esp: string, data: string) =>
    `*Agendamento confirmado!*\n\n${data}\n${esp}\n\nAté lá! Se precisar de algo, é só chamar.`,
  agendamentoJaExiste: 'Seu agendamento já foi confirmado! Se precisar de mais alguma coisa, é só chamar.',
  alterarOQue: 'O que deseja alterar?',
  agendamentoCancelado: 'Agendamento cancelado. Se precisar, é só chamar!',
  horarioOcupado: 'Esse horário acabou de ser ocupado. Vou buscar outros.',
  agendamentoErro: 'Tive um problema ao criar o agendamento. Vou transferir para um atendente.',

  escalado: 'Vou transferir você para um de nossos atendentes. Um momento, por favor.',
  concluido: 'Se precisar de mais alguma coisa, é só me chamar!',

  retomada: (contexto: string) => `Olá! Você estava agendando ${contexto}. Quer continuar?`,
  reinicio: 'Olá! Que bom ter você de volta. Vamos começar um novo agendamento.\n\nPara agendar sua consulta, preciso do seu *CPF*.',
  foraHorario: 'Nosso atendimento é de segunda a sexta, das 8h às 18h. Retorne nesse horário!',
  sessaoLimpa: 'Conversa reiniciada.',
} as const;

// Helpers para criar respostas tipadas
export function text(t: string): BotResponse {
  return { type: 'text', text: t };
}

export function buttons(t: string, btns: { id: string; label: string }[]): BotResponse {
  return { type: 'buttons', text: t, buttons: btns };
}

export function list(
  t: string,
  buttonLabel: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]
): BotResponse {
  return { type: 'list', text: t, buttonLabel, sections };
}
