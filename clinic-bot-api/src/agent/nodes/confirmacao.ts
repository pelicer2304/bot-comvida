import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { BookingState } from '../state';
import { config } from '../../config';
import { logError } from '../../logger';

function makeLlm() {
  return new ChatOpenAI({
    model: config.openai.model,
    apiKey: config.openai.apiKey,
    configuration: { baseURL: config.openai.baseUrl },
  });
}

async function callMcp(name: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${config.mcp.url}/tool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': config.mcp.apiKey },
    body: JSON.stringify({ tool: name, args }),
  });
  if (!res.ok) throw new Error(`MCP error ${res.status}`);
  return res.json();
}

async function classifyConfirmation(state: BookingState): Promise<'confirmar' | 'alterar' | 'cancelar' | 'outro'> {
  const llm = makeLlm().withStructuredOutput(z.object({
    resposta: z.enum(['confirmar', 'alterar', 'cancelar', 'outro']),
  }));
  const lastUser = [...state.messages].reverse().find(m => m._getType() === 'human');
  const userText = typeof lastUser?.content === 'string' ? lastUser.content : '';
  const result = await llm.invoke([
    new SystemMessage('O paciente está revisando o resumo do agendamento. Classifique: "confirmar" (quer confirmar), "alterar" (quer mudar algo), "cancelar" (quer cancelar), "outro".'),
    new HumanMessage(userText),
  ]);
  return result.resposta;
}

async function classifyAlteracao(state: BookingState): Promise<'especialidade' | 'horarios' | 'convenio' | 'outro'> {
  const llm = makeLlm().withStructuredOutput(z.object({
    campo: z.enum(['especialidade', 'horarios', 'convenio', 'outro']),
  }));
  const lastUser = [...state.messages].reverse().find(m => m._getType() === 'human');
  const userText = typeof lastUser?.content === 'string' ? lastUser.content : '';
  const result = await llm.invoke([
    new SystemMessage('O paciente quer alterar algo no agendamento. Identifique o que: "especialidade", "horarios" (data/hora), "convenio", "outro".'),
    new HumanMessage(userText),
  ]);
  return result.campo;
}

function formatarResumo(state: BookingState): string {
  const { paciente, convenio, especialidade, horario } = state;
  const [ano, mes, dia] = (horario?.data ?? '').split('-');
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const dataFormatada = horario ? `${diasSemana[data.getDay()]}, ${dia}/${mes}/${ano} às ${horario.hora}` : '-';

  return `📋 *Resumo do agendamento:*\n\n` +
    `👤 Paciente: ${paciente?.nome ?? '-'}\n` +
    `🏥 Especialidade: ${especialidade?.nome ?? '-'}\n` +
    `📅 Data e hora: ${dataFormatada}\n` +
    `💳 Convênio: ${convenio?.nome ?? '-'}\n\n` +
    `Confirma o agendamento?`;
}

export async function confirmacaoNode(state: BookingState): Promise<Partial<BookingState>> {
  try {
    const { paciente, convenio, especialidade, horario, agendamentoId } = state;

    // Idempotência — já foi criado
    if (agendamentoId) {
      return {
        messages: [new AIMessage(`Seu agendamento já foi confirmado! ✅\n\nSe precisar de mais alguma coisa, estou à disposição.`)],
        step: 'concluido',
        lastActivityAt: new Date().toISOString(),
      };
    }

    // Dados incompletos — volta para etapa faltante
    if (!paciente) return { step: 'identificacao', lastActivityAt: new Date().toISOString() };
    if (!convenio) return { step: 'convenio', lastActivityAt: new Date().toISOString() };
    if (!especialidade) return { step: 'especialidade', lastActivityAt: new Date().toISOString() };
    if (!horario) return { step: 'horarios', lastActivityAt: new Date().toISOString() };

    // Primeira vez no nó — apresenta resumo
    const ultimaAi = [...state.messages].reverse().find(m => m._getType() === 'ai');
    const ultimaAiTexto = typeof ultimaAi?.content === 'string' ? ultimaAi.content : '';
    const jaApresentouResumo = ultimaAiTexto.includes('Resumo do agendamento');

    if (!jaApresentouResumo) {
      return {
        messages: [new AIMessage(formatarResumo(state))],
        lastActivityAt: new Date().toISOString(),
      };
    }

    const resposta = await classifyConfirmation(state);

    if (resposta === 'alterar') {
      const campo = await classifyAlteracao(state);
      const stepMap: Record<string, BookingState['step']> = {
        especialidade: 'especialidade',
        horarios: 'horarios',
        convenio: 'convenio',
        outro: 'horarios',
      };
      return {
        messages: [new AIMessage('Claro! Vamos ajustar. Um momento...')],
        step: stepMap[campo],
        horario: campo === 'horarios' ? undefined : horario,
        especialidade: campo === 'especialidade' ? undefined : especialidade,
        convenio: campo === 'convenio' ? undefined : convenio,
        lastActivityAt: new Date().toISOString(),
      };
    }

    if (resposta === 'cancelar') {
      return {
        messages: [new AIMessage('Agendamento cancelado. Se precisar remarcar, é só me chamar! 😊')],
        step: 'concluido',
        lastActivityAt: new Date().toISOString(),
      };
    }

    if (resposta !== 'confirmar') {
      return {
        messages: [new AIMessage(formatarResumo(state))],
        lastActivityAt: new Date().toISOString(),
      };
    }

    // Confirmar — cria o agendamento
    try {
      const resultado = await callMcp('criar_agendamento', {
        codPaciente: paciente.idPaciente,
        codProfissional: especialidade.idProfissional,
        data: horario.data,
        hora: horario.hora,
        intervalo: horario.intervalo,
        codProcedimento: horario.codProcedimento,
        codConvenio: convenio.codConvenio,
        codPlano: convenio.codPlano,
        codStatus: 2,
      }) as { codAgendamento?: number; id?: number };

      const id = resultado?.codAgendamento ?? resultado?.id ?? 0;
      const [ano, mes, dia] = horario.data.split('-');

      return {
        messages: [new AIMessage(`✅ Agendamento confirmado!\n\n*${especialidade.nome}* — ${dia}/${mes}/${ano} às ${horario.hora}\n\nAté lá! 😊`)],
        agendamentoId: id,
        step: 'concluido',
        lastActivityAt: new Date().toISOString(),
      };
    } catch (e) {
      const msg = (e as Error).message ?? '';
      const horarioOcupado = msg.includes('disponível') || msg.includes('ocupado');
      if (horarioOcupado) {
        return {
          messages: [new AIMessage('Ops! Esse horário acabou de ser ocupado. Vou buscar outras opções disponíveis.')],
          horario: undefined,
          step: 'horarios',
          lastActivityAt: new Date().toISOString(),
        };
      }
      logError('confirmacao', 'criar_agendamento', e);
      return {
        messages: [new AIMessage('Tive um problema ao criar o agendamento. Vou transferir para um atendente.')],
        step: 'escalado',
        lastActivityAt: new Date().toISOString(),
      };
    }
  } catch (e) {
    logError('confirmacao', 'confirmacaoNode', e);
    return {
      messages: [new AIMessage('Tive um problema ao processar sua resposta. Pode repetir?')],
      lastActivityAt: new Date().toISOString(),
    };
  }
}
