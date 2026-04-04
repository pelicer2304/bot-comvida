import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { BookingState } from '../state';
import { config } from '../../config';
import { logError } from '../../logger';

interface Horario {
  data: string;
  hora: string;
  intervalo: number;
  idProfissional?: number;
}

const COD_PROCEDIMENTO_CONSULTA = 241681;

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

async function buscarTodosHorarios(ids: number[], diasParaFrente: number): Promise<Horario[]> {
  const resultados = await Promise.all(
    ids.map(async (id) => {
      try {
        const raw = await callMcp('proximos_horarios_livres', { idProfissional: id, diasParaFrente }) as Horario[];
        return (Array.isArray(raw) ? raw : []).map(h => ({ ...h, idProfissional: id }));
      } catch { return []; }
    })
  );
  return resultados.flat().sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));
}

function formatarHorario(h: Horario): string {
  const [ano, mes, dia] = h.data.split('-');
  const dow = new Date(Number(ano), Number(mes) - 1, Number(dia)).getDay();
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return `${dias[dow]}, ${dia}/${mes} às ${h.hora}`;
}

function periodos(horarios: Horario[]) {
  const manha = horarios.filter(h => h.hora < '12:00');
  const tarde = horarios.filter(h => h.hora >= '12:00' && h.hora < '18:00');
  const noite = horarios.filter(h => h.hora >= '18:00');
  return { manha, tarde, noite };
}

async function classifyPeriodo(userText: string): Promise<'manha' | 'tarde' | 'noite' | 'nenhum' | 'qualquer'> {
  const llm = makeLlm().withStructuredOutput(z.object({
    periodo: z.enum(['manha', 'tarde', 'noite', 'nenhum', 'qualquer']),
  }));
  const result = await llm.invoke([
    new SystemMessage('Classifique a preferência de período do paciente: "manha" (manhã/antes do meio-dia), "tarde" (tarde/após 12h), "noite" (noite/após 18h), "nenhum" (não pode nenhum / nenhum serve / não tem disponibilidade), "qualquer" (sem preferência).'),
    new HumanMessage(userText),
  ]);
  return result.periodo;
}

async function classifySelecao(userText: string, opcoes: Horario[]): Promise<number | null> {
  const llm = makeLlm().withStructuredOutput(z.object({
    indice: z.number().nullable().describe('índice 0-based da opção escolhida, ou null'),
  }));
  const lista = opcoes.map((h, i) => `${i + 1}. ${formatarHorario(h)}`).join('\n');
  const result = await llm.invoke([
    new SystemMessage(`O paciente está escolhendo um horário:\n${lista}\nRetorne o índice 0-based ou null se não escolheu / não pode nenhum.`),
    new HumanMessage(userText),
  ]);
  return result.indice;
}

function listarOpcoes(opcoes: Horario[]): string {
  return opcoes.map((h, i) => `${i + 1}. ${formatarHorario(h)}`).join('\n');
}

export async function horariosNode(state: BookingState): Promise<Partial<BookingState>> {
  try {
    const { especialidade } = state;
    if (!especialidade) {
      return { step: 'especialidade', lastActivityAt: new Date().toISOString() };
    }

    const ids = especialidade.idsProfissionais ?? [especialidade.idProfissional];
    const lastUser = [...state.messages].reverse().find(m => m._getType() === 'human');
    const userText = typeof lastUser?.content === 'string' ? lastUser.content : '';
    const lastAi = [...state.messages].reverse().find(m => m._getType() === 'ai');
    const lastAiText = typeof lastAi?.content === 'string' ? lastAi.content : '';

    // ── Sub-estado: perguntando período ──────────────────────────────────────
    const perguntouPeriodo = lastAiText.includes('manhã') && lastAiText.includes('tarde');
    if (perguntouPeriodo) {
      const pref = await classifyPeriodo(userText);

      if (pref === 'nenhum') {
        return {
          messages: [new AIMessage(`Entendido! Vou transferir para um atendente que pode verificar outras opções para ${especialidade.nome}.`)],
          step: 'escalado',
          lastActivityAt: new Date().toISOString(),
        };
      }

      const todos = await buscarTodosHorarios(ids, 15);
      const { manha, tarde, noite } = periodos(todos);
      const mapa: Record<string, Horario[]> = { manha, tarde, noite, qualquer: todos };
      const opcoes = (mapa[pref] ?? todos).slice(0, 3);

      if (!opcoes.length) {
        const nomePeriodo = pref === 'manha' ? 'manhã' : pref === 'tarde' ? 'tarde' : 'noite';
        return {
          messages: [new AIMessage(`Não há horários disponíveis no período da ${nomePeriodo} para ${especialidade.nome}. Vou transferir para um atendente.`)],
          step: 'escalado',
          lastActivityAt: new Date().toISOString(),
        };
      }

      const nomePeriodo = pref === 'manha' ? 'manhã' : pref === 'tarde' ? 'tarde' : pref === 'noite' ? 'noite' : '';
      return {
        messages: [new AIMessage(`Horários disponíveis${nomePeriodo ? ` pela ${nomePeriodo}` : ''}:\n\n${listarOpcoes(opcoes)}\n\nQual você prefere?`)],
        lastActivityAt: new Date().toISOString(),
      };
    }

    // ── Sub-estado: opções já listadas, aguardando seleção ───────────────────
    const listouOpcoes = /\d\. (Segunda|Terça|Quarta|Quinta|Sexta|Sábado|Domingo)/.test(lastAiText);
    if (listouOpcoes) {
      const todos = await buscarTodosHorarios(ids, 15);
      const foiManha = lastAiText.includes('manhã');
      const foiTarde = lastAiText.includes('tarde');
      const foiNoite = lastAiText.includes('noite');
      const { manha, tarde, noite } = periodos(todos);
      let opcoes = todos.slice(0, 3);
      if (foiManha && !foiTarde) opcoes = manha.slice(0, 3);
      else if (foiTarde && !foiManha) opcoes = tarde.slice(0, 3);
      else if (foiNoite) opcoes = noite.slice(0, 3);

      const indice = await classifySelecao(userText, opcoes);

      if (indice !== null && indice >= 0 && indice < opcoes.length) {
        const escolhido = opcoes[indice];
        const idProf = escolhido.idProfissional ?? especialidade.idProfissional;
        return {
          messages: [new AIMessage(`Ótimo! *${formatarHorario(escolhido)}* selecionado. Vou preparar o resumo para confirmação.`)],
          horario: { data: escolhido.data, hora: escolhido.hora, intervalo: escolhido.intervalo ?? 30, codProcedimento: COD_PROCEDIMENTO_CONSULTA },
          especialidade: { ...especialidade, idProfissional: idProf },
          step: 'confirmacao',
          lastActivityAt: new Date().toISOString(),
        };
      }

      const pref = await classifyPeriodo(userText);
      if (pref === 'nenhum') {
        return {
          messages: [new AIMessage('Entendido! Vou transferir para um atendente que pode verificar outras opções.')],
          step: 'escalado',
          lastActivityAt: new Date().toISOString(),
        };
      }

      return {
        messages: [new AIMessage('Por favor, escolha um dos horários acima digitando o número (1, 2 ou 3).')],
        lastActivityAt: new Date().toISOString(),
      };
    }

    // ── Primeira vez no nó: busca horários ───────────────────────────────────
    let todos = await buscarTodosHorarios(ids, 7);
    if (!todos.length) todos = await buscarTodosHorarios(ids, 15);

    if (!todos.length) {
      return {
        messages: [new AIMessage(`Não encontrei horários disponíveis para *${especialidade.nome}* nos próximos 15 dias. Vou transferir para um atendente.`)],
        step: 'escalado',
        lastActivityAt: new Date().toISOString(),
      };
    }

    const { manha, tarde, noite } = periodos(todos);
    const periodosDisponiveis = [
      manha.length ? 'manhã' : null,
      tarde.length ? 'tarde' : null,
      noite.length ? 'noite' : null,
    ].filter(Boolean);

    if (periodosDisponiveis.length === 1) {
      const opcoes = (manha.length ? manha : tarde.length ? tarde : noite).slice(0, 3);
      return {
        messages: [new AIMessage(`Encontrei horários disponíveis para *${especialidade.nome}* pela ${periodosDisponiveis[0]}:\n\n${listarOpcoes(opcoes)}\n\nQual você prefere?`)],
        lastActivityAt: new Date().toISOString(),
      };
    }

    return {
      messages: [new AIMessage(`Encontrei horários para *${especialidade.nome}* nos períodos: *${periodosDisponiveis.join('* e *')}*.\n\nQual período você prefere?`)],
      lastActivityAt: new Date().toISOString(),
    };

  } catch (e) {
    logError('horarios', 'horariosNode', e);
    return {
      messages: [new AIMessage('Tive um problema ao buscar os horários. Pode tentar novamente?')],
      lastActivityAt: new Date().toISOString(),
    };
  }
}
