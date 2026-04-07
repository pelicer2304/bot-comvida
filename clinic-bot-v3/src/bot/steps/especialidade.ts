import { StepHandler } from '../../state/types';
import { text, buttons, MSG } from '../messages';
import { getProfissionais } from '../../base/loader';
import { checkCobertura } from '../../base/cobertura-checker';
import { buildEspecialidadeList } from './helpers';

export const especialidadeStep: StepHandler = async (session, input) => {
  const { subStep } = session;

  // Primeira vez — mostra lista
  if (!subStep || subStep === 'escolher') {
    return {
      responses: [buildEspecialidadeList()],
      stateUpdate: { subStep: 'aguardando_selecao' },
    };
  }

  // Aguardando seleção
  if (subStep === 'aguardando_selecao') {
    const espMatch = input.match(/^esp_(.+)$/);
    const nomeEsp = espMatch ? espMatch[1] : input.trim();

    const profissionais = getProfissionais();
    const profsEsp = profissionais.filter(p =>
      p.especialidades.some(e => e.toLowerCase() === nomeEsp.toLowerCase())
    );

    if (!profsEsp.length) {
      return {
        responses: [text(`Não encontrei profissionais para "${nomeEsp}". Por favor, selecione da lista.`), buildEspecialidadeList()],
        stateUpdate: {},
      };
    }

    // Verificar cobertura
    const codConvenio = session.convenio?.codConvenio ?? -1;
    if (codConvenio !== -1) {
      const cobertura = checkCobertura(codConvenio, nomeEsp);
      if (!cobertura.coberto) {
        return {
          responses: [buttons(MSG.especialidadeNaoCoberta(nomeEsp), [
            { id: 'esp_particular', label: '💰 Sim, particular' },
            { id: 'esp_outra', label: '🔄 Outra especialidade' },
            { id: 'esp_atendente', label: '👤 Atendente' },
          ])],
          stateUpdate: { subStep: 'nao_coberta', tempData: { espNome: nomeEsp, profsIds: profsEsp.map(p => p.idUsuario) } },
        };
      }
    }

    return {
      responses: [text(MSG.especialidadeConfirmada(nomeEsp)), buttons('', [{ id: 'buscar_horarios', label: '🔍 Buscar horários' }])],
      stateUpdate: {
        step: 'horarios',
        subStep: 'aguardando_busca',
        especialidade: { nome: nomeEsp, idProfissional: profsEsp[0].idUsuario, idsProfissionais: profsEsp.map(p => p.idUsuario) },
      },
    };
  }

  // Não coberta — decisão
  if (subStep === 'nao_coberta') {
    if (input === 'esp_particular') {
      const espNome = session.tempData?.espNome as string;
      const profsIds = session.tempData?.profsIds as number[];
      return {
        responses: [text(MSG.especialidadeConfirmada(espNome)), buttons('', [{ id: 'buscar_horarios', label: '🔍 Buscar horários' }])],
        stateUpdate: {
          step: 'horarios',
          subStep: 'aguardando_busca',
          convenio: { codConvenio: -1, codPlano: -2, nome: 'Particular' },
          especialidade: { nome: espNome, idProfissional: profsIds[0], idsProfissionais: profsIds },
          tempData: undefined,
        },
      };
    }
    if (input === 'esp_outra') {
      return {
        responses: [buildEspecialidadeList()],
        stateUpdate: { subStep: 'aguardando_selecao', tempData: undefined },
      };
    }
    return {
      responses: [text(MSG.escalado)],
      stateUpdate: { step: 'escalado', tempData: undefined },
    };
  }

  return {
    responses: [buildEspecialidadeList()],
    stateUpdate: { subStep: 'aguardando_selecao' },
  };
};
