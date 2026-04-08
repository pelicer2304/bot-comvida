import { StepHandler } from '../../state/types';
import { text, buttons, MSG } from '../messages';
import { getProfissionais } from '../../base/loader';
import { checkCobertura } from '../../base/cobertura-checker';
import {
  buildCategoriaList,
  buildEspecialidadeList,
  findCategoriaBySlug,
  resolveEspSlug,
} from './helpers';

export const especialidadeStep: StepHandler = async (session, input) => {
  const { subStep } = session;
  const normalized = input.trim().toLowerCase();

  console.log(`[esp] subStep=${subStep} input="${input.slice(0, 80)}"`);

  // "menu" ou "voltar" → volta pras categorias
  if (normalized === 'menu' || normalized === 'voltar') {
    return {
      responses: [buildCategoriaList()],
      stateUpdate: { subStep: 'aguardando_categoria' },
    };
  }

  // Passo 1 — mostrar categorias
  if (!subStep || subStep === 'escolher' || subStep === 'aguardando_categoria') {
    // Se veio um clique de categoria
    const catMatch = input.match(/^cat_(.+)$/);
    if (catMatch) {
      const cat = findCategoriaBySlug(catMatch[1]);
      if (cat) {
        const espList = buildEspecialidadeList(cat);
        return {
          responses: [espList],
          stateUpdate: { subStep: 'aguardando_selecao', tempData: { catSlug: cat.slug } },
        };
      }
    }

    // Primeira entrada ou input não reconhecido → mostra categorias
    return {
      responses: [buildCategoriaList()],
      stateUpdate: { subStep: 'aguardando_categoria' },
    };
  }

  // Passo 2 — aguardando seleção de especialidade
  if (subStep === 'aguardando_selecao') {
    // Se clicou numa categoria ao invés de especialidade (voltou)
    const catMatch = input.match(/^cat_(.+)$/);
    if (catMatch) {
      const cat = findCategoriaBySlug(catMatch[1]);
      if (cat) {
        return {
          responses: [buildEspecialidadeList(cat)],
          stateUpdate: { subStep: 'aguardando_selecao', tempData: { catSlug: cat.slug } },
        };
      }
    }

    // Resolver especialidade
    const espMatch = input.match(/^esp_(.+)$/);
    const slug = espMatch ? espMatch[1] : null;
    const nomeEsp = slug ? resolveEspSlug(slug) : null;

    if (!nomeEsp) {
      // Tenta voltar pra categoria atual ou mostra categorias
      const catSlug = session.tempData?.catSlug as string | undefined;
      const cat = catSlug ? findCategoriaBySlug(catSlug) : null;
      if (cat) {
        return {
          responses: [text('Nao encontrei essa especialidade. Selecione da lista.'), buildEspecialidadeList(cat)],
          stateUpdate: {},
        };
      }
      return {
        responses: [text('Nao encontrei essa especialidade. Selecione uma categoria.'), buildCategoriaList()],
        stateUpdate: { subStep: 'aguardando_categoria' },
      };
    }

    // Buscar profissionais
    const profissionais = getProfissionais();
    const profsEsp = profissionais.filter(p =>
      p.especialidades.some(e => e.toLowerCase() === nomeEsp.toLowerCase())
    );

    if (!profsEsp.length) {
      return {
        responses: [text(`Nao encontrei profissionais para "${nomeEsp}". Selecione outra.`), buildCategoriaList()],
        stateUpdate: { subStep: 'aguardando_categoria', tempData: undefined },
      };
    }

    // Verificar cobertura
    const codConvenio = session.convenio?.codConvenio ?? -1;
    if (codConvenio !== -1) {
      const cobertura = checkCobertura(codConvenio, nomeEsp);
      if (!cobertura.coberto) {
        return {
          responses: [buttons(MSG.especialidadeNaoCoberta(nomeEsp), [
            { id: 'esp_particular', label: 'Sim, particular' },
            { id: 'esp_outra', label: 'Outra especialidade' },
            { id: 'esp_atendente', label: 'Atendente' },
          ])],
          stateUpdate: {
            subStep: 'nao_coberta',
            tempData: { espNome: nomeEsp, profsIds: profsEsp.map(p => p.idUsuario) },
          },
        };
      }
    }

    // Confirmada — segue pra horários
    return {
      responses: [text(MSG.especialidadeConfirmada(nomeEsp))],
      stateUpdate: {
        step: 'horarios',
        subStep: 'buscar',
        especialidade: {
          nome: nomeEsp,
          idProfissional: profsEsp[0].idUsuario,
          idsProfissionais: profsEsp.map(p => p.idUsuario),
        },
        tempData: undefined,
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
          subStep: 'buscar',
          convenio: { codConvenio: -1, codPlano: -2, nome: 'Particular' },
          especialidade: { nome: espNome, idProfissional: profsIds[0], idsProfissionais: profsIds },
          tempData: undefined,
        },
      };
    }
    if (input === 'esp_outra') {
      return {
        responses: [buildCategoriaList()],
        stateUpdate: { subStep: 'aguardando_categoria', tempData: undefined },
      };
    }
    return {
      responses: [text(MSG.escalado)],
      stateUpdate: { step: 'escalado', tempData: undefined },
    };
  }

  // Fallback
  return {
    responses: [buildCategoriaList()],
    stateUpdate: { subStep: 'aguardando_categoria' },
  };
};
