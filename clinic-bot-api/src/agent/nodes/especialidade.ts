import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { BookingState } from '../state';
import { config } from '../../config';
import { getProfissionais } from '../../base/loader';
import { checkCobertura } from '../../base/cobertura-checker';
import { logError } from '../../logger';

const REPLY_PROMPT = `Você é a recepcionista virtual da Clínica Comvida. Sua tarefa é identificar a especialidade desejada.
Nunca mostre idProfissional ou IDs técnicos ao paciente.
Responda em português brasileiro, tom cordial e natural.
Hoje é ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;

function makeLlm() {
  return new ChatOpenAI({
    model: config.openai.model,
    apiKey: config.openai.apiKey,
    configuration: { baseURL: config.openai.baseUrl },
  });
}

async function classifyEspecialidade(state: BookingState): Promise<{ especialidade: string | null }> {
  const especialidades = [...new Set(
    getProfissionais().flatMap(p => p.especialidades)
  )].filter(Boolean);

  const llm = makeLlm().withStructuredOutput(z.object({
    especialidade: z.string().nullable().describe('nome da especialidade médica identificada, ou null se não identificada'),
  }));

  const lastUser = [...state.messages].reverse().find(m => m._getType() === 'human');
  const userText = typeof lastUser?.content === 'string' ? lastUser.content : '';

  return llm.invoke([
    new SystemMessage(`Você é um assistente de agendamento. Identifique se o paciente está informando ou sugerindo uma especialidade médica.
Especialidades disponíveis: ${especialidades.join(', ')}.
Mapeie sintomas e sinônimos populares para a especialidade correta:
- "coração", "dor no peito", "dor no coração", "cardíaco" → Cardiologia
- "osso", "coluna", "joelho", "fratura" → Ortopedia
- "pele", "manchas", "acne" → Dermatologia
- "olho", "visão" → Oftalmologia
- "ouvido", "garganta", "nariz" → Otorrinolaringologia
- "criança", "filho", "bebê" → Pediatria
Se identificar qualquer especialidade ou sintoma relacionado, retorne o nome canônico da lista. Caso contrário, retorne null.`),
    new HumanMessage(userText),
  ]);
}

async function reply(state: BookingState, instruction: string): Promise<string> {
  const llm = makeLlm();
  const response = await llm.invoke([
    new SystemMessage(REPLY_PROMPT),
    ...state.messages,
    new HumanMessage(`[INSTRUÇÃO INTERNA] ${instruction}`),
  ]);
  return typeof response.content === 'string'
    ? response.content
    : (response.content as { type: string; text?: string }[]).find(c => c.type === 'text')?.text ?? '';
}

export async function especialidadeNode(state: BookingState): Promise<Partial<BookingState>> {
  try {
  const { especialidade } = await classifyEspecialidade(state);

  if (!especialidade) {
    const msg = await reply(state, 'Você é recepcionista de clínica. Pergunte qual especialidade médica o paciente deseja agendar (ex: Cardiologia, Ortopedia, Clínica Geral). Não dê conselhos médicos.');
    return { messages: [new AIMessage(msg)], lastActivityAt: new Date().toISOString() };
  }

  const profissionais = getProfissionais();
  const profissionaisEsp = profissionais.filter(p =>
    p.especialidades.some(e => e.toLowerCase() === especialidade.toLowerCase())
  );

  if (!profissionaisEsp.length) {
    const msg = await reply(state, `Informe que não temos profissional disponível para ${especialidade} no momento e pergunte se deseja outra especialidade.`);
    return {
      messages: [new AIMessage(msg)],
      tentativas: { ...state.tentativas, especialidade: (state.tentativas.especialidade ?? 0) + 1 },
      lastActivityAt: new Date().toISOString(),
    };
  }

  const profissional = profissionaisEsp[0];

  // Check insurance coverage (skip for particular)
  const codConvenio = state.convenio?.codConvenio ?? -1;
  if (codConvenio !== -1) {
    const cobertura = checkCobertura(codConvenio, especialidade);
    if (!cobertura.coberto) {
      const msg = await reply(state, `Informe que o convênio ${state.convenio?.nome} não cobre ${especialidade} e ofereça atendimento particular.`);
      return {
        messages: [new AIMessage(msg)],
        tentativas: { ...state.tentativas, especialidade: (state.tentativas.especialidade ?? 0) + 1 },
        lastActivityAt: new Date().toISOString(),
      };
    }
  }

  return {
    messages: [new AIMessage(`Ótimo! Vou verificar os horários disponíveis para *${especialidade}*.`)],
    especialidade: { nome: especialidade, idProfissional: profissional.idUsuario, idsProfissionais: profissionaisEsp.map(p => p.idUsuario) },
    step: 'horarios',
    lastActivityAt: new Date().toISOString(),
  };
  } catch (e) {
    logError('especialidade', 'especialidadeNode', e);
    return {
      messages: [new AIMessage('Tive um problema ao processar sua resposta. Pode repetir?')],
      lastActivityAt: new Date().toISOString(),
    };
  }
}
