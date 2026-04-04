import { StepHandler } from '../../state/types';
import { text, buttons, list, MSG } from '../messages';
import { getProfissionais } from '../../base/loader';
import { checkCobertura } from '../../base/cobertura-checker';

export const especialidadeStep: StepHandler = async (session, input) => {
  const { subStep } = session;

  // Primeira vez — mostra lista de especialidades
  if (!subStep || subStep === 'escolher') {
    const profissionais = getProfissionais();
    const especialidades = [...new Set(profissionais.flatMap(p => p.especialidades))].filter(Boolean).sort();

    if (!especialidades.length) {
      return {
        responses: [text('Não há especialidades disponíveis no momento. Vou transferir para um atendente.')],
        stateUpdate: { step: 'escalado' },
      };
    }

    return {
      responses: [list(
        MSG.especialidadeEscolher,
        'Ver especialidades',
        [{ title: 'Especialidades', rows: especialidades.map(e => ({ id: `esp_${e}`, title: e })) }]
      )],
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
        responses: [text(`Não encontrei profissionais para "${nomeEsp}". Por favor, selecione da lista.`)],
        stateUpdate: { subStep: 'escolher' },
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
      responses: [text(MSG.especialidadeConfirmada(nomeEsp))],
      stateUpdate: {
        step: 'horarios',
        subStep: undefined,
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
        responses: [text(MSG.especialidadeConfirmada(espNome))],
        stateUpdate: {
          step: 'horarios',
          subStep: undefined,
          convenio: { codConvenio: -1, codPlano: -2, nome: 'Particular' },
          especialidade: { nome: espNome, idProfissional: profsIds[0], idsProfissionais: profsIds },
          tempData: undefined,
        },
      };
    }
    if (input === 'esp_outra') {
      return {
        responses: [],
        stateUpdate: { subStep: 'escolher', tempData: undefined },
      };
    }
    return {
      responses: [text(MSG.escalado)],
      stateUpdate: { step: 'escalado', tempData: undefined },
    };
  }

  return {
    responses: [],
    stateUpdate: { subStep: 'escolher' },
  };
};
