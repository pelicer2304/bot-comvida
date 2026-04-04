import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { BookingState } from '../state';
import { config } from '../../config';
import { logError } from '../../logger';

const REPLY_PROMPT = `Você é a recepcionista virtual da Clínica Comvida. Sua tarefa é identificar o paciente.
Colete um dado por vez. Nunca mostre IDs técnicos ao paciente.
Responda em português brasileiro, tom cordial e natural.
Hoje é ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;

interface PacienteApi {
  idPaciente: number;
  nome: string;
  dataNascimento: string;
}

function makeLlm() {
  return new ChatOpenAI({
    model: config.openai.model,
    apiKey: config.openai.apiKey,
    configuration: { baseURL: config.openai.baseUrl },
  });
}

async function callMcp(name: string, args: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${config.mcp.url}/tool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': config.mcp.apiKey },
    body: JSON.stringify({ tool: name, args }),
  });
  if (!res.ok) throw new Error(`MCP error ${res.status}`);
  const data = await res.json() as unknown;
  return typeof data === 'string' ? data : JSON.stringify(data);
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

// Extracts CPF from the last user message first, then falls back to history
function extractCpf(messages: BookingState['messages']): string | null {
  const lastUser = [...messages].reverse().find(m => m._getType() === 'human');
  const lastText = typeof lastUser?.content === 'string' ? lastUser.content : '';
  const lastMatch = lastText.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11}/);
  if (lastMatch) return lastMatch[0].replace(/\D/g, '');
  // fallback: scan full history (for registration flow where CPF was sent earlier)
  const allText = messages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
  const match = allText.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11}/);
  return match ? match[0].replace(/\D/g, '') : null;
}

// Extracts date — structured datum, regex is appropriate
function extractDate(text: string): string | null {
  const withSep = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (withSep) return `${withSep[3]}-${withSep[2]}-${withSep[1]}`;
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const noSep = text.match(/\b(\d{2})(\d{2})(\d{4})\b/);
  if (noSep) return `${noSep[3]}-${noSep[2]}-${noSep[1]}`;
  return null;
}

async function classifyConfirmation(state: BookingState, context: string): Promise<'sim' | 'nao' | 'outro'> {
  const llm = makeLlm().withStructuredOutput(z.object({
    resposta: z.enum(['sim', 'nao', 'outro']),
  }));
  const lastUser = [...state.messages].reverse().find(m => m._getType() === 'human');
  const userText = typeof lastUser?.content === 'string' ? lastUser.content : '';
  const result = await llm.invoke([
    new SystemMessage(`O paciente está respondendo a: "${context}". Classifique como "sim" (qualquer afirmação, interesse ou aceitação — ex: "sim", "gostaria", "quero", "pode", "vamos", "claro", "ok", "isso"), "nao" (qualquer negação — ex: "não", "nao", "agora não", "depois") ou "outro" (dúvida, pergunta, fora de contexto).`),
    new HumanMessage(userText),
  ]);
  return result.resposta;
}

async function classifySexo(state: BookingState): Promise<'M' | 'F' | null> {
  const llm = makeLlm().withStructuredOutput(z.object({
    sexo: z.enum(['M', 'F', 'indefinido']),
  }));
  const lastUser = [...state.messages].reverse().find(m => m._getType() === 'human');
  const userText = typeof lastUser?.content === 'string' ? lastUser.content : '';
  const result = await llm.invoke([
    new SystemMessage('O paciente está informando o sexo biológico. Classifique como M (masculino), F (feminino) ou indefinido.'),
    new HumanMessage(userText),
  ]);
  return result.sexo === 'indefinido' ? null : result.sexo;
}

async function criarPaciente(
  state: BookingState,
  dados: { nome: string; cpf: string; dataNascimento: string; sexo: 'M' | 'F' | 'I' }
): Promise<Partial<BookingState>> {
  try {
    const result = await callMcp('criar_paciente', {
      nomeCompleto: dados.nome,
      cpf: dados.cpf,
      dataNascimento: dados.dataNascimento,
      sexo: dados.sexo,
    });
    const paciente = JSON.parse(result) as PacienteApi;
    const msg = await reply(state, `Cadastro realizado com sucesso para ${dados.nome.split(' ')[0]}. Informe isso ao paciente e pergunte se possui convênio médico.`);
    return {
      messages: [new AIMessage(msg)],
      paciente: { idPaciente: paciente.idPaciente, nome: dados.nome, dataNascimento: dados.dataNascimento },
      cadastroPendente: undefined,
      step: 'convenio',
      lastActivityAt: new Date().toISOString(),
    };
  } catch (e) {
    logError('identificacao', 'criar_paciente', e);
    return {
      messages: [new AIMessage('Tive um problema ao realizar o cadastro. Vou transferir para um atendente.')],
      cadastroPendente: undefined,
      step: 'escalado' as BookingState['step'],
      lastActivityAt: new Date().toISOString(),
    };
  }
}

export async function identificacaoNode(state: BookingState): Promise<Partial<BookingState>> {
  const lastUser = [...state.messages].reverse().find(m => m._getType() === 'human');
  const userText = typeof lastUser?.content === 'string' ? lastUser.content.trim() : '';

  // Sub-state: confirming identity
  if (state.pacientePendente) {
    const resposta = await classifyConfirmation(state, `Encontrei ${state.pacientePendente.nome} no sistema. É você?`);
    if (resposta === 'sim') {
      return {
        messages: [new AIMessage('Ótimo! Identidade confirmada.\n\nVocê possui convênio médico?')],
        paciente: state.pacientePendente,
        pacientePendente: undefined,
        step: 'convenio',
        lastActivityAt: new Date().toISOString(),
      };
    }
    if (resposta === 'nao') {
      return {
        messages: [new AIMessage('Entendido. Pode me informar o CPF correto para que eu tente novamente?')],
        pacientePendente: undefined,
        lastActivityAt: new Date().toISOString(),
      };
    }
    const msg = await reply(state, `Reformule a pergunta de confirmação de identidade para ${state.pacientePendente.nome}.`);
    return { messages: [new AIMessage(msg)], lastActivityAt: new Date().toISOString() };
  }

  // Sub-state: collecting registration data
  if (state.cadastroPendente) {
    const cadastro = state.cadastroPendente;

    if (!cadastro.dataNascimento) {
      const dataNascimento = extractDate(userText);
      if (dataNascimento) {
        const sexo = await classifySexo(state);
        if (sexo) return criarPaciente(state, { ...cadastro, dataNascimento, sexo });
        return {
          messages: [new AIMessage('Perfeito! Qual é o seu sexo? (M para masculino, F para feminino)')],
          cadastroPendente: { ...cadastro, dataNascimento },
          lastActivityAt: new Date().toISOString(),
        };
      }
      return { messages: [new AIMessage('Por favor, informe sua data de nascimento no formato DD/MM/AAAA.')], lastActivityAt: new Date().toISOString() };
    }

    const sexo = await classifySexo(state);
    if (sexo) return criarPaciente(state, { ...cadastro, sexo });
    return { messages: [new AIMessage('Por favor, informe o sexo: M para masculino ou F para feminino.')], lastActivityAt: new Date().toISOString() };
  }

  // Sub-state: awaiting registration confirmation
  if (state.aguardandoCadastro) {
    const resposta = await classifyConfirmation(state, 'Gostaria de se cadastrar agora?');
    if (resposta === 'sim') {
      const cpf = extractCpf(state.messages);
      const humanMsgs = state.messages.filter(m => m._getType() === 'human');
      const nomeMsg = humanMsgs.find(m => {
        const t = (typeof m.content === 'string' ? m.content : '').trim();
        return t.length > 3 && !/\d{8,}/.test(t) && t.split(' ').length >= 2;
      });
      const nome = typeof nomeMsg?.content === 'string' ? nomeMsg.content.trim() : '';
      return {
        messages: [new AIMessage('Ótimo! Vamos fazer o seu cadastro. Por favor, informe sua data de nascimento no formato DD/MM/AAAA.')],
        cadastroPendente: { nome, cpf: cpf ?? '' },
        aguardandoCadastro: false,
        lastActivityAt: new Date().toISOString(),
      };
    }
    if (resposta === 'nao') {
      return {
        messages: [new AIMessage('Tudo bem! Se precisar de ajuda, estou à disposição. Vou transferir para um atendente.')],
        aguardandoCadastro: false,
        step: 'escalado',
        lastActivityAt: new Date().toISOString(),
      };
    }
    // 'outro' — repergunta sem vazar para o bloco de CPF
    return {
      messages: [new AIMessage('Gostaria de se cadastrar agora para agilizar o atendimento?')],
      lastActivityAt: new Date().toISOString(),
    };
  }

  // CPF detection — structured datum, regex is appropriate
  const hasCpf = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11}/.test(userText.replace(/\s/g, ''));
  if (hasCpf) {
    const cpf = extractCpf(state.messages);
    if (cpf) {
      let pacienteEncontrado: PacienteApi | null = null;
      try {
        const result = await callMcp('buscar_pacientes', { query: cpf });
        const pacientes = JSON.parse(result) as PacienteApi[];
        pacienteEncontrado = pacientes[0] ?? null;
      } catch (e) {
        logError('identificacao', 'buscar_pacientes', e);
      }

      if (pacienteEncontrado?.nome) {
        return {
          messages: [new AIMessage(`Encontrei o cadastro de *${pacienteEncontrado.nome}* no sistema. Esse é você?`)],
          pacientePendente: pacienteEncontrado,
          lastActivityAt: new Date().toISOString(),
        };
      }

      const tentativas = (state.tentativas.cpf ?? 0) + 1;
      if (tentativas >= 2) {
        return {
          messages: [new AIMessage('Não consegui localizar seu cadastro. Vou transferir para um atendente que poderá te ajudar melhor.')],
          tentativas: { ...state.tentativas, cpf: tentativas },
          step: 'escalado',
          lastActivityAt: new Date().toISOString(),
        };
      }

      return {
        messages: [new AIMessage('Não localizamos esse CPF em nosso sistema. Gostaria de se cadastrar agora?')],

        tentativas: { ...state.tentativas, cpf: tentativas },
        aguardandoCadastro: true,
        lastActivityAt: new Date().toISOString(),
      };
    }
  }

  // Default: LLM collects name / CPF
  const msg = await reply(state, 'Colete nome completo e CPF do paciente para identificação.');
  return { messages: [new AIMessage(msg)], lastActivityAt: new Date().toISOString() };
}
