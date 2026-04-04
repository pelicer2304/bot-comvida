import { StateGraph, END } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { config } from '../config';
import { BookingStateAnnotation, BookingState } from './state';
import { buildSystemPrompt } from './prompt';
import { extractState, detectaRetomada } from './extractor';
import { agentTools, setToolThreadId } from './tools';
import { logMessage, logToolCall, logToolResult, logStateUpdate, logError } from '../logger';

function parseToolResult(toolName: string, raw: string, current: BookingState, toolArgs?: Record<string, unknown>): Partial<BookingState> {
  try {
    const data = JSON.parse(raw);
    if (toolName === 'buscar_pacientes') {
      const p = Array.isArray(data) ? data[0] : data;
      if (p?.idPaciente) return { paciente: { idPaciente: p.idPaciente, nome: p.nome, dataNascimento: p.dataNascimento } };
    }
    if (toolName === 'criar_paciente') {
      const p = data?.data ?? data;
      if (p?.idPaciente) return { paciente: { idPaciente: p.idPaciente, nome: p.nome ?? p.nomeCompleto, dataNascimento: p.dataNascimento } };
    }
    if (toolName === 'criar_agendamento') {
      const id = data?.data?.codAgendamento ?? data?.codAgendamento;
      if (id) return { agendamentoId: id };
    }
  } catch { /* raw não é JSON válido */ }
  return {};
}

const DEBOUNCE_MS = 10000;
const MAX_TOOL_ITER = 10;

let _checkpointer: PostgresSaver | null = null;
let _compiled: ReturnType<ReturnType<typeof buildGraph>['compile']> | null = null;

function makeLlm() {
  return new ChatOpenAI({
    model: config.openai.model,
    apiKey: config.openai.apiKey,
    configuration: { baseURL: config.openai.baseUrl },
  }).bindTools(agentTools);
}

let _currentThreadId = '';

async function agenteNode(state: BookingState): Promise<Partial<BookingState>> {
  const threadId = _currentThreadId;
  setToolThreadId(threadId);
  const systemPrompt = buildSystemPrompt(state);
  const llm = makeLlm();

  const messages = [
    new SystemMessage(systemPrompt),
    ...state.messages.slice(-25),
  ];

  let iterations = 0;
  let currentMessages = [...messages];
  let toolStateUpdates: Partial<BookingState> = {};

  while (iterations < MAX_TOOL_ITER) {
    iterations++;
    const response = await llm.invoke(currentMessages);
    currentMessages.push(response);

    const toolCalls = response.tool_calls ?? [];
    if (!toolCalls.length) {
      const reply = typeof response.content === 'string'
        ? response.content
        : (response.content as { type: string; text?: string }[]).find(c => c.type === 'text')?.text
          ?? 'Desculpe, pode repetir?';

      const lastHuman = [...currentMessages].reverse().find(m => m._getType?.() === 'human');
      const patientMsg = typeof lastHuman?.content === 'string' ? lastHuman.content : undefined;
      const stepUpdate = await extractState(state, reply, patientMsg);
      const stateUpdate = { ...toolStateUpdates, ...stepUpdate };
      if (Object.keys(stateUpdate).length) logStateUpdate(threadId ?? 'unknown', stateUpdate);

      return {
        messages: [new AIMessage(reply)],
        lastActivityAt: new Date().toISOString(),
        ...stateUpdate,
      };
    }

    const toolResults = await Promise.all(
      toolCalls.map(async (tc) => {
        logToolCall(threadId ?? 'unknown', tc.name, tc.args);
        const t0 = Date.now();
        let result: string;
        try {
          const t = agentTools.find(t => t.name === tc.name);
          if (!t) throw new Error(`Tool desconhecida: ${tc.name}`);
          result = await t.invoke(tc.args as Record<string, unknown>);
          const parsed = parseToolResult(tc.name, result, { ...state, ...toolStateUpdates }, tc.args as Record<string, unknown>);
          if (Object.keys(parsed).length) toolStateUpdates = { ...toolStateUpdates, ...parsed };
        } catch (e) {
          if (tc.name === 'proximos_horarios_livres') {
            result = '[]';
          } else if (tc.name === 'buscar_planos_convenio' || tc.name === 'listar_convenios') {
            // erros em tools locais não devem chegar ao LLM como erro — retorna vazio
            result = '[]';
          } else {
            result = `Erro: ${(e as Error).message}`;
          }
        }
        logToolResult(threadId ?? 'unknown', tc.name, result, Date.now() - t0);
        return new HumanMessage({
          content: result,
          additional_kwargs: { tool_call_id: tc.id, role: 'tool', name: tc.name },
        });
      })
    );

    currentMessages.push(...toolResults);
  }

  return {
    messages: [new AIMessage('Tive um problema ao processar sua solicitação. Pode repetir?')],
    lastActivityAt: new Date().toISOString(),
  };
}

function entradaNode(state: BookingState): Partial<BookingState> {
  if (state.step === 'resetado') return { step: 'identificacao' };

  const inativo = Date.now() - new Date(state.lastActivityAt).getTime();
  const MIN_30 = 30 * 60 * 1000;
  const H_24 = 24 * 60 * 60 * 1000;

  if (inativo > H_24) {
    return {
      messages: [new AIMessage('Olá! Que bom ter você de volta. Vamos começar um novo agendamento. Pode me informar seu nome completo?')],
      step: 'identificacao',
      paciente: undefined,
      convenio: undefined,
      especialidade: undefined,
      horario: undefined,
      agendamentoId: undefined,
      tentativas: {},
      lastActivityAt: new Date().toISOString(),
    };
  }

  if (inativo > MIN_30 && state.step !== 'identificacao') {
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

function routeEntrada(state: BookingState): string {
  if (state.step === 'concluido') return 'concluido';
  if (state.step === 'escalado') return 'escalado_check';
  return 'agente';
}

async function escaladoCheckNode(state: BookingState): Promise<Partial<BookingState>> {
  const lastMsg = [...state.messages].reverse().find(m => m._getType?.() === 'human');
  const txt = typeof lastMsg?.content === 'string' ? lastMsg.content : '';
  if (!txt) return {};

  const retoma = await detectaRetomada(txt);
  if (retoma) return { step: state.paciente ? 'convenio' : 'identificacao' };
  return {};
}

function routeEscaladoCheck(state: BookingState): string {
  if (state.step === 'escalado') return 'escalado';
  return 'agente';
}

function buildGraph() {
  return new StateGraph(BookingStateAnnotation)
    .addNode('node_entrada', entradaNode)
    .addNode('node_agente', agenteNode)
    .addNode('node_escalado_check', escaladoCheckNode)
    .addNode('node_concluido', async () => ({
      messages: [new AIMessage('Agendamento concluído! Se precisar de mais alguma coisa, é só me chamar. 😊')],
    }))
    .addNode('node_escalado', async () => ({
      messages: [new AIMessage('Vou transferir você para um de nossos atendentes. Um momento, por favor.')],
    }))
    .addEdge('__start__' as never, 'node_entrada')
    .addConditionalEdges('node_entrada', routeEntrada, {
      agente: 'node_agente',
      concluido: 'node_concluido',
      escalado_check: 'node_escalado_check',
    })
    .addConditionalEdges('node_escalado_check', routeEscaladoCheck, {
      agente: 'node_agente',
      escalado: 'node_escalado',
    })
    .addEdge('node_agente', END)
    .addEdge('node_concluido', END)
    .addEdge('node_escalado', END);
}

export async function initGraph() {
  _checkpointer = PostgresSaver.fromConnString(config.postgres.url);
  await _checkpointer.setup();
  _compiled = buildGraph().compile({ checkpointer: _checkpointer });
}

export async function clearThread(threadId: string): Promise<void> {
  await _checkpointer!.deleteThread(threadId);
}

// ── Fila por threadId (evita concorrência) ────────────────────────────────────
const _queue = new Map<string, Promise<void>>();

// ── Debounce (agrega mensagens rápidas do WhatsApp) ───────────────────────────
interface DebounceEntry {
  messages: string[];
  timer: ReturnType<typeof setTimeout>;
  resolve: (msg: string) => void;
}
const _debounce = new Map<string, DebounceEntry>();

async function _invoke(threadId: string, userMessage: string): Promise<string> {
  logMessage(threadId, 'user', userMessage);
  _currentThreadId = threadId;
  setToolThreadId(threadId);

  const t0 = Date.now();
  const result = await _compiled!.invoke(
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

  logMessage(threadId, 'bot', reply);
  console.log(`[perf] _invoke total: ${Date.now() - t0}ms`);
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
    else entry.resolve = resolve;

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
        // log completo do erro para debug
        try { logError(threadId, 'invokeAgent_raw', JSON.parse(JSON.stringify(e, Object.getOwnPropertyNames(e)))); } catch {}
        entry.resolve('Desculpe, ocorreu um erro. Pode repetir?');
      } finally {
        slotResolve();
        if (_queue.get(threadId) === slot) _queue.delete(threadId);
      }
    }, DEBOUNCE_MS);
  });
}
