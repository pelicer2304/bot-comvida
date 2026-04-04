import { StateGraph, END } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { config } from '../config';
import { BookingStateAnnotation, BookingState } from './state';
import { logError, logConversation } from '../logger';
import { identificacaoNode } from './nodes/identificacao';
import { convenioNode } from './nodes/convenio';
import { especialidadeNode } from './nodes/especialidade';
import { horariosNode } from './nodes/horarios';
import { confirmacaoNode } from './nodes/confirmacao';
import { routeByStep } from './nodes/router';
import { getBotConfig } from '../admin/botConfig';

const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

function isDentroDoHorario(): boolean {
  const cfg = getBotConfig();
  if (!cfg.botAtivo) return false;
  const now = new Date();
  const dia = DIAS[now.getDay()];
  const horario = cfg.horarioAtendimento?.[dia];
  if (!horario?.ativo) return false;
  const [hIni, mIni] = horario.inicio.split(':').map(Number);
  const [hFim, mFim] = horario.fim.split(':').map(Number);
  const minutos = now.getHours() * 60 + now.getMinutes();
  return minutos >= hIni * 60 + mIni && minutos < hFim * 60 + mFim;
}

let _graph: ReturnType<typeof buildGraph> | null = null;
let _checkpointer: PostgresSaver | null = null;

function entradaNode(state: BookingState): Partial<BookingState> {
  const { lastActivityAt, step } = state;

  // Verificação de horário de atendimento (lê config em runtime — hot-reload)
  if (!isDentroDoHorario() && step !== 'concluido' && step !== 'escalado') {
    const cfg = getBotConfig();
    return {
      messages: [new AIMessage(cfg.mensagemForaHorario)],
      step: 'escalado' as BookingState['step'],
    };
  }

  // Após reset, volta para identificacao na próxima mensagem
  if (step === 'resetado') {
    return { step: 'identificacao' };
  }

  if (!lastActivityAt || step === 'identificacao') return {};

  const inativo = Date.now() - new Date(lastActivityAt).getTime();
  const MIN_30 = 30 * 60 * 1000;
  const H_24 = 24 * 60 * 60 * 1000;

  if (inativo > H_24) {
    return {
      messages: [new AIMessage('Olá! Que bom ter você de volta. Vamos começar um novo agendamento. Pode me informar seu nome completo?')],
      step: 'resetado' as BookingState['step'],
      paciente: undefined,
      convenio: undefined,
      especialidade: undefined,
      horario: undefined,
      pacientePendente: undefined,
      cadastroPendente: undefined,
      aguardandoCadastro: false,
      agendamentoId: undefined,
      tentativas: {},
      lastActivityAt: new Date().toISOString(),
    };
  }

  if (inativo > MIN_30) {
    const contexto = state.especialidade?.nome
      ? `uma consulta de *${state.especialidade.nome}*`
      : 'um agendamento';
    return {
      messages: [new AIMessage(`Olá! Você estava agendando ${contexto}. Quer continuar de onde parou?`)],
      lastActivityAt: new Date().toISOString(),
    };
  }

  return {};
}

function buildGraph() {
  const graph = new StateGraph(BookingStateAnnotation)
    .addNode('node_entrada', entradaNode)
    .addNode('node_identificacao', identificacaoNode)
    .addNode('node_convenio', convenioNode)
    .addNode('node_especialidade', especialidadeNode)
    .addNode('node_horarios', horariosNode)
    .addNode('node_confirmacao', confirmacaoNode)
    .addNode('node_concluido', async (_s) => ({
      messages: [new AIMessage('Agendamento concluído! Se precisar de mais alguma coisa, é só me chamar. 😊')],
    }))
    .addNode('node_escalado', async (_s) => ({
      messages: [new AIMessage('Vou transferir você para um de nossos atendentes. Um momento, por favor.')],
    }))
    .addEdge('__start__' as never, 'node_entrada')
    .addConditionalEdges('node_entrada', routeByStep, {
      identificacao: 'node_identificacao',
      convenio: 'node_convenio',
      especialidade: 'node_especialidade',
      horarios: 'node_horarios',
      confirmacao: 'node_confirmacao',
      concluido: 'node_concluido',
      escalado: 'node_escalado',
      resetado: END,
    })
    .addEdge('node_identificacao', END)
    .addEdge('node_convenio', END)
    .addEdge('node_especialidade', END)
    .addEdge('node_horarios', END)
    .addEdge('node_confirmacao', END)
    .addEdge('node_concluido', END)
    .addEdge('node_escalado', END);

  return graph;
}

async function getGraph() {
  if (_graph) return _graph;

  _checkpointer = PostgresSaver.fromConnString(config.postgres.url);
  await _checkpointer.setup();

  _graph = buildGraph();
  return _graph;
}

export async function clearThread(threadId: string): Promise<void> {
  await getGraph();
  await _checkpointer!.deleteThread(threadId);
}

const _queue = new Map<string, Promise<void>>();

interface DebounceEntry {
  messages: string[];
  timer: ReturnType<typeof setTimeout>;
  resolve: (msg: string) => void;
}
const _debounce = new Map<string, DebounceEntry>();
const DEBOUNCE_MS = 4000;

async function _invoke(threadId: string, userMessage: string): Promise<string> {
  const graph = await getGraph();

  logConversation(threadId, 'user', userMessage);

  const compiled = graph.compile({ checkpointer: _checkpointer! });

  const result = await compiled.invoke(
    { messages: [new HumanMessage(userMessage)] },
    { configurable: { thread_id: threadId } }
  );

  const messages = result.messages as { _getType?: () => string; content: unknown }[];
  const last = [...messages].reverse().find(m => {
    if (m._getType?.() !== 'ai') return false;
    const c = m.content;
    if (typeof c === 'string') return c.trim().length > 0;
    if (Array.isArray(c)) return c.some((b: { type: string; text?: string }) => b.type === 'text' && b.text?.trim());
    return false;
  });

  if (!last) return 'Desculpe, ocorreu um erro. Pode repetir?';

  const reply = typeof last.content === 'string'
    ? last.content
    : (last.content as { type: string; text?: string }[]).find(c => c.type === 'text')?.text
      ?? 'Desculpe, ocorreu um erro. Pode repetir?';

  logConversation(threadId, 'bot', reply);
  return reply;
}

export async function invokeAgent(threadId: string, userMessage: string): Promise<string> {
  return new Promise<string>((resolve) => {
    const existing = _debounce.get(threadId);
    if (existing) {
      clearTimeout(existing.timer);
      existing.messages.push(userMessage);
    }

    const entry = existing ?? { messages: [userMessage], timer: null as never, resolve };
    if (!existing) _debounce.set(threadId, entry);
    else entry.resolve = resolve; // last caller gets the reply

    entry.timer = setTimeout(async () => {
      _debounce.delete(threadId);
      const combined = entry.messages.join('\n');

      const prev = _queue.get(threadId) ?? Promise.resolve();
      let slotResolve!: () => void;
      const slot = new Promise<void>(r => { slotResolve = r; });
      _queue.set(threadId, prev.then(() => slot));
      await prev;
      try {
        const reply = await _invoke(threadId, combined);
        entry.resolve(reply);
      } catch (e) {
        logError(threadId, 'invokeAgent', e);
        entry.resolve('Desculpe, ocorreu um erro. Pode repetir?');
      } finally {
        slotResolve();
        if (_queue.get(threadId) === slot) _queue.delete(threadId);
      }
    }, DEBOUNCE_MS);
  });
}
