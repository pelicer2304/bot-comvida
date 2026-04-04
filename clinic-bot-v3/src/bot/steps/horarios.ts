import { StepHandler } from '../../state/types';
import { text, buttons, list, MSG } from '../messages';
import { cw, HorarioLivre } from '../../clinicweb/client';
import { logError } from '../../logger';

const COD_PROCEDIMENTO = 241681;
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface HorarioComProf extends HorarioLivre { idProfissional?: number; }

function formatHorario(h: HorarioLivre): string {
  const [ano, mes, dia] = h.data.split('-');
  const dow = new Date(Number(ano), Number(mes) - 1, Number(dia)).getDay();
  return `${DIAS[dow]}, ${dia}/${mes} às ${h.hora}`;
}

async function buscarHorarios(ids: number[], dias: number): Promise<HorarioComProf[]> {
  const todos: HorarioComProf[] = [];
  for (const id of ids) {
    try {
      const raw = await cw.proximosHorariosLivres(id, dias);
      if (Array.isArray(raw)) todos.push(...raw.map(h => ({ ...h, idProfissional: id })));
    } catch { /* sem agenda */ }
  }
  return todos.sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));
}

export const horariosStep: StepHandler = async (session, input) => {
  const { subStep, especialidade } = session;
  if (!especialidade) return { responses: [], stateUpdate: { step: 'especialidade', subStep: undefined } };

  const ids = especialidade.idsProfissionais ?? [especialidade.idProfissional];
  const page = (session.tempData?.page as number) ?? 0;

  // Primeira vez ou "ver mais"
  if (!subStep || subStep === 'buscar' || input === 'horarios_mais') {
    try {
      let horarios = await buscarHorarios(ids, 7);
      if (!horarios.length) horarios = await buscarHorarios(ids, 15);

      if (!horarios.length) {
        return {
          responses: [buttons(MSG.horariosVazio(especialidade.nome), [
            { id: 'esp_outra', label: '🔄 Outra especialidade' },
            { id: 'horarios_atendente', label: '👤 Falar com atendente' },
          ])],
          stateUpdate: { subStep: 'sem_horarios' },
        };
      }

      const nextPage = input === 'horarios_mais' ? page + 1 : 0;
      const slice = horarios.slice(nextPage * 10, (nextPage + 1) * 10);
      const hasMore = horarios.length > (nextPage + 1) * 10;

      const rows = slice.map((h, i) => ({
        id: `hor_${nextPage * 10 + i}`,
        title: formatHorario(h),
      }));

      const extraBtns: { id: string; label: string }[] = [];
      if (hasMore) extraBtns.push({ id: 'horarios_mais', label: '📅 Ver mais horários' });
      extraBtns.push({ id: 'horarios_atendente', label: '👤 Atendente' });

      return {
        responses: [
          list(MSG.horariosBuscando(especialidade.nome), 'Ver horários', [{ title: 'Horários', rows }]),
          ...(extraBtns.length ? [buttons('', extraBtns)] : []),
        ],
        stateUpdate: {
          subStep: 'aguardando_selecao',
          tempData: { horarios, page: nextPage },
        },
      };
    } catch (e) {
      logError('horarios', 'buscarHorarios', e);
      return {
        responses: [text('Tive um problema ao buscar horários. Vou transferir para um atendente.')],
        stateUpdate: { step: 'escalado' },
      };
    }
  }

  // Seleção de horário
  if (subStep === 'aguardando_selecao') {
    const horarios = session.tempData?.horarios as HorarioComProf[];
    const match = input.match(/^hor_(\d+)$/);
    const idx = match ? parseInt(match[1]) : -1;

    if (idx >= 0 && idx < horarios.length) {
      const h = horarios[idx];
      return {
        responses: [text(MSG.horarioSelecionado(formatHorario(h)))],
        stateUpdate: {
          step: 'confirmacao',
          subStep: undefined,
          horario: { data: h.data, hora: h.hora, intervalo: h.intervalo ?? 30, codProcedimento: COD_PROCEDIMENTO },
          especialidade: { ...especialidade, idProfissional: h.idProfissional ?? especialidade.idProfissional },
          tempData: undefined,
        },
      };
    }

    return {
      responses: [text('Por favor, selecione um horário da lista.')],
      stateUpdate: {},
    };
  }

  // Sem horários — decisão
  if (subStep === 'sem_horarios') {
    if (input === 'esp_outra') {
      return { responses: [], stateUpdate: { step: 'especialidade', subStep: 'escolher', especialidade: undefined, tempData: undefined } };
    }
    return { responses: [text(MSG.escalado)], stateUpdate: { step: 'escalado' } };
  }

  return { responses: [], stateUpdate: { subStep: 'buscar' } };
};
