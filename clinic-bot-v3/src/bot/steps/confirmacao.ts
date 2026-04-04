import { StepHandler } from '../../state/types';
import { text, buttons, MSG } from '../messages';
import { cw } from '../../clinicweb/client';
import { logError } from '../../logger';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function formatData(data: string, hora: string): string {
  const [ano, mes, dia] = data.split('-');
  const dow = new Date(Number(ano), Number(mes) - 1, Number(dia)).getDay();
  return `${DIAS[dow]}, ${dia}/${mes}/${ano} às ${hora}`;
}

export const confirmacaoStep: StepHandler = async (session, input) => {
  const { paciente, convenio, especialidade, horario, agendamentoId, subStep } = session;

  if (agendamentoId) {
    return { responses: [text(MSG.agendamentoJaExiste)], stateUpdate: { step: 'concluido' } };
  }

  if (!paciente) return { responses: [], stateUpdate: { step: 'identificacao', subStep: 'aguardando_cpf' } };
  if (!convenio) return { responses: [], stateUpdate: { step: 'convenio', subStep: 'escolher_tipo' } };
  if (!especialidade) return { responses: [], stateUpdate: { step: 'especialidade', subStep: 'escolher' } };
  if (!horario) return { responses: [], stateUpdate: { step: 'horarios', subStep: 'buscar' } };

  // Mostrar resumo
  if (!subStep || subStep === 'mostrar_resumo') {
    const dataFmt = formatData(horario.data, horario.hora);
    return {
      responses: [buttons(MSG.resumo(paciente.nome, especialidade.nome, dataFmt, convenio.nome), [
        { id: 'confirmar', label: '✅ Confirmar' },
        { id: 'alterar', label: '✏️ Alterar' },
        { id: 'cancelar', label: '❌ Cancelar' },
      ])],
      stateUpdate: { subStep: 'aguardando_decisao' },
    };
  }

  // Decisão
  if (subStep === 'aguardando_decisao') {
    if (input === 'confirmar' || /^s/i.test(input) || /confirm/i.test(input)) {
      try {
        const result = await cw.criarAgendamento({
          codPaciente: paciente.idPaciente,
          codProfissional: especialidade.idProfissional,
          data: horario.data,
          hora: horario.hora,
          intervalo: horario.intervalo,
          codProcedimento: horario.codProcedimento,
          codConvenio: convenio.codConvenio,
          codPlano: convenio.codPlano,
        }) as { codAgendamento?: number; id?: number };

        const id = result?.codAgendamento ?? result?.id ?? 0;
        const dataFmt = formatData(horario.data, horario.hora);

        return {
          responses: [text(MSG.agendamentoConfirmado(especialidade.nome, dataFmt))],
          stateUpdate: { step: 'concluido', subStep: undefined, agendamentoId: id },
        };
      } catch (e) {
        const msg = (e as Error).message ?? '';
        if (msg.includes('disponível') || msg.includes('ocupado')) {
          return {
            responses: [text(MSG.horarioOcupado)],
            stateUpdate: { step: 'horarios', subStep: 'buscar', horario: undefined },
          };
        }
        logError('confirmacao', 'criarAgendamento', e);
        return {
          responses: [text(MSG.agendamentoErro)],
          stateUpdate: { step: 'escalado' },
        };
      }
    }

    if (input === 'alterar') {
      return {
        responses: [buttons(MSG.alterarOQue, [
          { id: 'alterar_horario', label: '📅 Horário' },
          { id: 'alterar_especialidade', label: '🏥 Especialidade' },
          { id: 'alterar_convenio', label: '💳 Convênio' },
        ])],
        stateUpdate: { subStep: 'escolher_alteracao' },
      };
    }

    if (input === 'cancelar' || /cancel/i.test(input)) {
      return {
        responses: [text(MSG.agendamentoCancelado)],
        stateUpdate: { step: 'concluido', subStep: undefined },
      };
    }

    return { responses: [], stateUpdate: { subStep: 'mostrar_resumo' } };
  }

  // Escolher o que alterar
  if (subStep === 'escolher_alteracao') {
    const map: Record<string, Partial<typeof session>> = {
      alterar_horario: { step: 'horarios', subStep: 'buscar', horario: undefined },
      alterar_especialidade: { step: 'especialidade', subStep: 'escolher', especialidade: undefined, horario: undefined },
      alterar_convenio: { step: 'convenio', subStep: 'escolher_tipo', convenio: undefined, especialidade: undefined, horario: undefined },
    };
    const update = map[input];
    if (update) return { responses: [], stateUpdate: { ...update, tempData: undefined } };
    return { responses: [], stateUpdate: { subStep: 'mostrar_resumo' } };
  }

  return { responses: [], stateUpdate: { subStep: 'mostrar_resumo' } };
};
