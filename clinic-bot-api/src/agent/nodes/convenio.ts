import Fuse from 'fuse.js';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { BookingState } from '../state';
import { config } from '../../config';
import { matchConvenio } from '../../base/convenio-matcher';
import { logError } from '../../logger';

const REPLY_PROMPT = `Você é a recepcionista virtual da Clínica Comvida. Sua tarefa é identificar o convênio do paciente.
Responda de forma cordial e natural em português brasileiro.
Nunca mostre codConvenio, codPlano ou IDs técnicos ao paciente.
Hoje é ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;

const IntentSchema = z.object({
  intent: z.enum(['particular', 'nome_convenio', 'selecao_plano', 'pergunta', 'outro']),
  valor: z.string().nullable().optional().describe('nome do convênio ou número do plano quando aplicável'),
});

type Intent = z.infer<typeof IntentSchema>;

function matchPlano(conv: NonNullable<ReturnType<typeof matchConvenio>>, texto: string) {
  if (!texto) return null;
  const stopwords = /\b(acho|que|e|é|o|a|os|as|meu|minha|tenho|plano|seria|tipo)\b/gi;
  const cleaned = texto.replace(stopwords, ' ').replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
  const query = cleaned || texto;
  const fuse = new Fuse(conv.planos, { keys: ['plano'], threshold: 0.4, ignoreLocation: true });
  return fuse.search(query)[0]?.item ?? null;
}

const PLANOS_LISTA_MAX = 10;

function makeLlm() {
  return new ChatOpenAI({
    model: config.openai.model,
    apiKey: config.openai.apiKey,
    configuration: { baseURL: config.openai.baseUrl },
  });
}

async function classify(state: BookingState, context: string): Promise<Intent> {
  const llm = makeLlm().withStructuredOutput(IntentSchema);
  const lastUser = [...state.messages].reverse().find(m => m._getType() === 'human');
  const userText = typeof lastUser?.content === 'string' ? lastUser.content : '';
  return llm.invoke([
    new SystemMessage(`Classifique a mensagem do paciente no contexto: ${context}.
- "particular": quer pagar sem convênio. Exemplos: "não tenho convênio", "vou pagar particular", "não tenho plano", "sem convênio", "particular mesmo", "pago do próprio bolso"
- "nome_convenio": está informando o nome do convênio. Exemplos: "tenho Bradesco", "meu plano é Unimed", "uso Amil"
- "selecao_plano": está escolhendo um número de plano de uma lista apresentada
- "pergunta": está fazendo uma pergunta sobre convênios aceitos
- "outro": qualquer outra coisa`),
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

export async function convenioNode(state: BookingState): Promise<Partial<BookingState>> {
  try {
  // Sub-state: waiting for plan selection (lista ≤ PLANOS_LISTA_MAX)
  if (state.convenio?.codPlano === 0) {
    const conv = matchConvenio(state.convenio.nome);
    if (conv) {
      const lastUser = [...state.messages].reverse().find(m => m._getType() === 'human');
      const userText = typeof lastUser?.content === 'string' ? lastUser.content : '';

      if (conv.planos.length <= PLANOS_LISTA_MAX) {
        // lista numerada — classifica por número
        const intent = await classify(state, 'paciente está escolhendo o número do plano de uma lista');
        if (intent.intent === 'selecao_plano' && intent.valor) {
          const idx = parseInt(intent.valor) - 1;
          if (!isNaN(idx) && idx >= 0 && idx < conv.planos.length) {
            const plano = conv.planos[idx];
            return {
              messages: [new AIMessage(`Perfeito! Convênio ${conv.descricaoConvenio} com plano *${plano.plano}* confirmado. Qual especialidade você deseja agendar?`)],
              convenio: { codConvenio: conv.codConvenio, codPlano: plano.codPlano, nome: conv.descricaoConvenio },
              step: 'especialidade',
              lastActivityAt: new Date().toISOString(),
            };
          }
        }
        const planosLista = conv.planos.map((p, i) => `${i + 1}. ${p.plano}`).join('\n');
        return { messages: [new AIMessage(`Por favor, escolha o número do seu plano:\n${planosLista}`)], lastActivityAt: new Date().toISOString() };
      } else {
        // muitos planos — fuzzy match por nome
        const plano = matchPlano(conv, userText);
        if (plano) {
          return {
            messages: [new AIMessage(`Convênio *${conv.descricaoConvenio}* com plano *${plano.plano}* confirmado. Qual especialidade você deseja agendar?`)],
            convenio: { codConvenio: conv.codConvenio, codPlano: plano.codPlano, nome: conv.descricaoConvenio },
            step: 'especialidade',
            lastActivityAt: new Date().toISOString(),
          };
        }
        return { messages: [new AIMessage(`Não encontrei esse plano. Pode informar o nome exato como aparece na sua carteirinha?`)], lastActivityAt: new Date().toISOString() };
      }
    }
  }

  const intent = await classify(state, 'paciente foi perguntado se tem convênio médico');

  if (intent.intent === 'particular') {
    return {
      messages: [new AIMessage('Entendido! Atendimento particular confirmado. Qual especialidade você deseja agendar?')],
      convenio: { codConvenio: -1, codPlano: -2, nome: 'Particular' },
      step: 'especialidade',
      lastActivityAt: new Date().toISOString(),
    };
  }

  if (intent.intent === 'nome_convenio' && intent.valor) {
    const conv = matchConvenio(intent.valor);

    if (!conv) {
      const msg = await reply(state, `Informe que não trabalhamos com o convênio "${intent.valor}" e pergunte se deseja atendimento particular.`);
      return {
        messages: [new AIMessage(msg)],
        tentativas: { ...state.tentativas, convenio: (state.tentativas.convenio ?? 0) + 1 },
        lastActivityAt: new Date().toISOString(),
      };
    }

    if (conv.planos.length === 1) {
      return {
        messages: [new AIMessage(`Convênio *${conv.descricaoConvenio}* confirmado. Qual especialidade você deseja agendar?`)],
        convenio: { codConvenio: conv.codConvenio, codPlano: conv.planos[0].codPlano, nome: conv.descricaoConvenio },
        step: 'especialidade',
        lastActivityAt: new Date().toISOString(),
      };
    }

    if (conv.planos.length <= PLANOS_LISTA_MAX) {
      const planosLista = conv.planos.map((p, i) => `${i + 1}. ${p.plano}`).join('\n');
      return {
        messages: [new AIMessage(`Convênio *${conv.descricaoConvenio}* identificado. Qual é o seu plano?\n\n${planosLista}`)],
        convenio: { codConvenio: conv.codConvenio, codPlano: 0, nome: conv.descricaoConvenio },
        lastActivityAt: new Date().toISOString(),
      };
    }

    // muitos planos — pede nome do plano por texto
    return {
      messages: [new AIMessage(`Convênio *${conv.descricaoConvenio}* identificado. Qual é o nome do seu plano? (como aparece na carteirinha)`)],
      convenio: { codConvenio: conv.codConvenio, codPlano: 0, nome: conv.descricaoConvenio },
      lastActivityAt: new Date().toISOString(),
    };
  }

  // pergunta, outro, ou primeira mensagem — LLM conduz
    const msg = await reply(state, 'Pergunte ou responda sobre convênio de forma natural, mantendo o foco em identificar o convênio do paciente.');
    return { messages: [new AIMessage(msg)], lastActivityAt: new Date().toISOString() };
  } catch (e) {
    logError('convenio', 'convenioNode', e);
    return {
      messages: [new AIMessage('Tive um problema ao processar sua resposta. Pode repetir?')],
      lastActivityAt: new Date().toISOString(),
    };
  }
}
