import Fuse from 'fuse.js';
import { StepHandler, SessionState } from '../../state/types';
import { text, buttons, list, MSG } from '../messages';
import { matchConvenio } from '../../base/convenio-matcher';
import { buildEspecialidadeList } from './helpers';

const PLANOS_LISTA_MAX = 10;

function confirmAndShowEsp(msg: string, stateUpdate: Partial<SessionState>) {
  return {
    responses: [text(msg), buildEspecialidadeList()],
    stateUpdate: { ...stateUpdate, step: 'especialidade' as const, subStep: 'aguardando_selecao' },
  };
}

export const convenioStep: StepHandler = async (session, input) => {
  const { subStep } = session;

  // Escolher tipo (botões)
  if (subStep === 'escolher_tipo') {
    if (input === 'convenio_particular' || /^particular$/i.test(input)) {
      return confirmAndShowEsp(MSG.particularConfirmado, {
        convenio: { codConvenio: -1, codPlano: -2, nome: 'Particular' },
      });
    }
    if (input === 'convenio_sim') {
      return {
        responses: [text(MSG.convenioDigitar)],
        stateUpdate: { subStep: 'aguardando_nome' },
      };
    }
    // Usuário digitou texto direto (ex: "amil") — trata como nome de convênio
    if (input && !input.startsWith('convenio_') && !/^(sim|n[aã]o)$/i.test(input)) {
      // Redireciona pro handler de nome
      return convenioStep({ ...session, subStep: 'aguardando_nome' }, input);
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
    if (/particular/i.test(input)) {
      return confirmAndShowEsp(MSG.particularConfirmado, {
        convenio: { codConvenio: -1, codPlano: -2, nome: 'Particular' },
      });
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

    if (conv.planos.length === 1) {
      return confirmAndShowEsp(MSG.convenioConfirmado(conv.descricaoConvenio), {
        convenio: { codConvenio: conv.codConvenio, codPlano: conv.planos[0].codPlano, nome: conv.descricaoConvenio },
      });
    }

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
      return confirmAndShowEsp(MSG.convenioComPlano(nomeConv, plano.plano), {
        convenio: { codConvenio: codConv, codPlano: plano.codPlano, nome: nomeConv },
        tempData: undefined,
      });
    }

    return { responses: [text('Por favor, selecione um plano da lista.')], stateUpdate: {} };
  }

  // Aguardando plano por texto (fuzzy)
  if (subStep === 'aguardando_plano_texto') {
    const planos = session.tempData?.planos as { codPlano: number; plano: string }[];
    const nomeConv = session.tempData?.nomeConvenio as string;
    const codConv = session.tempData?.codConvenio as number;

    const fuse = new Fuse(planos, { keys: ['plano'], threshold: 0.4, ignoreLocation: true });
    const result = fuse.search(input)[0]?.item;

    if (result) {
      return confirmAndShowEsp(MSG.convenioComPlano(nomeConv, result.plano), {
        convenio: { codConvenio: codConv, codPlano: result.codPlano, nome: nomeConv },
        tempData: undefined,
      });
    }

    return { responses: [text(MSG.convenioPlanoNaoEncontrado)], stateUpdate: {} };
  }

  return {
    responses: [buttons('Você possui convênio médico?', [
      { id: 'convenio_sim', label: '💳 Sim, tenho convênio' },
      { id: 'convenio_particular', label: '💰 Particular' },
    ])],
    stateUpdate: { subStep: 'escolher_tipo' },
  };
};
