import { SessionState, BotResponse, StepHandler } from '../state/types';
import { loadSession, saveSession, createSession, deleteSession } from '../state/store';
import { logMessage } from '../logger';
import { text, buttons, MSG } from './messages';
import { saudacaoStep } from './steps/saudacao';
import { identificacaoStep } from './steps/identificacao';
import { convenioStep } from './steps/convenio';
import { especialidadeStep } from './steps/especialidade';
import { horariosStep } from './steps/horarios';
import { confirmacaoStep } from './steps/confirmacao';

const stepHandlers: Record<string, StepHandler> = {
  saudacao: saudacaoStep,
  identificacao: identificacaoStep,
  convenio: convenioStep,
  especialidade: especialidadeStep,
  horarios: horariosStep,
  confirmacao: confirmacaoStep,
  concluido: async () => ({ responses: [text(MSG.concluido)], stateUpdate: {} }),
  escalado: async () => ({ responses: [text(MSG.escalado)], stateUpdate: {} }),
};

const MIN_30 = 30 * 60 * 1000;
const H_24 = 24 * 60 * 60 * 1000;

function checkTimeout(session: SessionState): { session: SessionState; extraResponses: BotResponse[] } {
  const inativo = Date.now() - new Date(session.lastActivityAt).getTime();
  const extra: BotResponse[] = [];

  if (inativo > H_24) {
    const fresh = createSession(session.phone);
    fresh.step = 'identificacao';
    fresh.subStep = 'aguardando_cpf';
    extra.push(text(MSG.reinicio));
    return { session: fresh, extraResponses: extra };
  }

  if (inativo > MIN_30 && session.step !== 'saudacao' && session.step !== 'concluido' && session.step !== 'escalado') {
    const contexto = session.especialidade?.nome
      ? `uma consulta de *${session.especialidade.nome}*`
      : 'um agendamento';
    extra.push(buttons(MSG.retomada(contexto), [
      { id: 'retomar_sim', label: '✅ Continuar' },
      { id: 'retomar_nao', label: '🔄 Recomeçar' },
    ]));
  }

  return { session, extraResponses: extra };
}

// Mutex por phone
const _queue = new Map<string, Promise<void>>();

export async function processMessage(phone: string, input: string): Promise<BotResponse[]> {
  const prev = _queue.get(phone) ?? Promise.resolve();
  let resolve!: () => void;
  const slot = new Promise<void>(r => { resolve = r; });
  _queue.set(phone, prev.then(() => slot));
  await prev;

  try {
    return await _processMessage(phone, input);
  } finally {
    resolve();
    if (_queue.get(phone) === slot) _queue.delete(phone);
  }
}

async function _processMessage(phone: string, input: string): Promise<BotResponse[]> {
  logMessage(phone, 'user', input);

  // Comando /clear
  if (input.trim() === '/clear') {
    await deleteSession(phone);
    return [text(MSG.sessaoLimpa)];
  }

  let session = await loadSession(phone) ?? createSession(phone);

  // Retomada de sessão
  if (input === 'retomar_nao') {
    session = createSession(phone);
    session.step = 'identificacao';
    session.subStep = 'aguardando_cpf';
    await saveSession(session);
    return [text(MSG.reinicio)];
  }
  if (input === 'retomar_sim') {
    session.lastActivityAt = new Date().toISOString();
    await saveSession(session);
    return [text('Ótimo! Vamos continuar de onde paramos.')];
  }

  const { session: checkedSession, extraResponses } = checkTimeout(session);
  session = checkedSession;

  // Se tem mensagem de retomada, envia e espera resposta
  if (extraResponses.length > 0) {
    session.lastActivityAt = new Date().toISOString();
    await saveSession(session);
    return extraResponses;
  }

  const handler = stepHandlers[session.step];
  if (!handler) {
    return [text('Erro interno. Digite /clear para reiniciar.')];
  }

  const result = await handler(session, input);
  const updated = { ...session, ...result.stateUpdate, lastActivityAt: new Date().toISOString() };
  await saveSession(updated);

  // Se step mudou e não tem respostas, executa o próximo step automaticamente
  if (result.responses.length === 0 && updated.step !== session.step) {
    const nextHandler = stepHandlers[updated.step];
    if (nextHandler) {
      const nextResult = await nextHandler(updated, '');
      const finalState = { ...updated, ...nextResult.stateUpdate, lastActivityAt: new Date().toISOString() };
      await saveSession(finalState);
      result.responses.push(...nextResult.responses);
    }
  }

  for (const r of result.responses) {
    if (r.type === 'text') logMessage(phone, 'bot', r.text);
    else if ('text' in r) logMessage(phone, 'bot', r.text);
  }

  return result.responses;
}
