import Fuse from 'fuse.js';
import { StepHandler } from '../../state/types';
import { text, buttons, list, MSG } from '../messages';
import { matchConvenio } from '../../base/convenio-matcher';

const PLANOS_LISTA_MAX = 10;

export const convenioStep: StepHandler = async (session, input) => {
  const { subStep } = session;

  // Escolher tipo (botões)
  if (subStep === 'escolher_tipo') {
    if (input === 'convenio_particular' || /particular/i.test(input)) {
      return {
        responses: [text(MSG.particularConfirmado)],
        stateUpdate: {
          step: 'especialidade',
          subStep: undefined,
          convenio: { codConvenio: -1, codPlano: -2, nome: 'Particular' },
        },
      };
    }
    if (input === 'convenio_sim' || /sim|tenho|convênio|convenio/i.test(input)) {
      return {
        responses: [text(MSG.convenioDigitar)],
        stateUpdate: { subStep: 'aguardando_nome' },
      };
    }
    return {
      responses: [buttons('Você possui convênio médico?', [
        { id: 'convenio_sim', label: '💳 Sim, tenho convênio' },
        { id: 'convenio_particular', label: '💰 Particular' },
      ])],
      stateUpdate: {},
    };
  }

  // Aguardando nome do convênio
  if (subStep === 'aguardando_nome') {
    // Checa se digitou "particular" direto
    if (/particular/i.test(input)) {
      return {
        responses: [text(MSG.particularConfirmado)],
        stateUpdate: {
          step: 'especialidade',
          subStep: undefined,
          convenio: { codConvenio: -1, codPlano: -2, nome: 'Particular' },
        },
      };
    }

    const conv = matchConvenio(input);
    if (!conv) {
      return {
        responses: [buttons(MSG.convenioNaoEncontrado(input), [
          { id: 'convenio_particular', label: '💰 Sim, particular' },
          { id: 'cadastrar_nao', label: '👤 Falar com atendente' },
        ])],
        stateUpdate: {},
      };
    }

    // 1 plano → confirma direto
    if (conv.planos.length === 1) {
      return {
        responses: [text(MSG.convenioConfirmado(conv.descricaoConvenio))],
        stateUpdate: {
          step: 'especialidade',
          subStep: undefined,
          convenio: { codConvenio: conv.codConvenio, codPlano: conv.planos[0].codPlano, nome: conv.descricaoConvenio },
        },
      };
    }

    // ≤10 planos → lista
    if (conv.planos.length <= PLANOS_LISTA_MAX) {
      return {
        responses: [list(
          MSG.convenioEscolherPlano(conv.descricaoConvenio),
          'Escolher plano',
          [{ title: 'Planos', rows: conv.planos.map((p, i) => ({ id: `plano_${i}`, title: p.plano })) }]
        )],
        stateUpdate: {
          subStep: 'aguardando_plano',
          tempData: { codConvenio: conv.codConvenio, nomeConvenio: conv.descricaoConvenio, planos: conv.planos },
        },
      };
    }

    // >10 planos → digitar
    return {
      responses: [text(MSG.convenioDigitarPlano(conv.descricaoConvenio))],
      stateUpdate: {
        subStep: 'aguardando_plano_texto',
        tempData: { codConvenio: conv.codConvenio, nomeConvenio: conv.descricaoConvenio, planos: conv.planos },
      },
    };
  }

  // Aguardando seleção de plano (lista)
  if (subStep === 'aguardando_plano') {
    const planos = session.tempData?.planos as { codPlano: number; plano: string }[];
    const nomeConv = session.tempData?.nomeConvenio as string;
    const codConv = session.tempData?.codConvenio as number;

    const match = input.match(/^plano_(\d+)$/);
    const idx = match ? parseInt(match[1]) : -1;

    if (idx >= 0 && idx < planos.length) {
      const plano = planos[idx];
      return {
        responses: [text(MSG.convenioComPlano(nomeConv, plano.plano))],
        stateUpdate: {
          step: 'especialidade',
          subStep: undefined,
          convenio: { codConvenio: codConv, codPlano: plano.codPlano, nome: nomeConv },
          tempData: undefined,
        },
      };
    }

    return {
      responses: [text('Por favor, selecione um plano da lista.')],
      stateUpdate: {},
    };
  }

  // Aguardando plano por texto (fuzzy)
  if (subStep === 'aguardando_plano_texto') {
    const planos = session.tempData?.planos as { codPlano: number; plano: string }[];
    const nomeConv = session.tempData?.nomeConvenio as string;
    const codConv = session.tempData?.codConvenio as number;

    const fuse = new Fuse(planos, { keys: ['plano'], threshold: 0.4, ignoreLocation: true });
    const result = fuse.search(input)[0]?.item;

    if (result) {
      return {
        responses: [text(MSG.convenioComPlano(nomeConv, result.plano))],
        stateUpdate: {
          step: 'especialidade',
          subStep: undefined,
          convenio: { codConvenio: codConv, codPlano: result.codPlano, nome: nomeConv },
          tempData: undefined,
        },
      };
    }

    return {
      responses: [text(MSG.convenioPlanoNaoEncontrado)],
      stateUpdate: {},
    };
  }

  // Fallback — re-perguntar
  return {
    responses: [buttons('Você possui convênio médico?', [
      { id: 'convenio_sim', label: '💳 Sim, tenho convênio' },
      { id: 'convenio_particular', label: '💰 Particular' },
    ])],
    stateUpdate: { subStep: 'escolher_tipo' },
  };
};
