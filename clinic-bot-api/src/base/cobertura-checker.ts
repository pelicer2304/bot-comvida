import { getConvenios } from './loader';

export interface CoberturaResult {
  coberto: boolean;
  observacao: string;
}

export function checkCobertura(codConvenio: number, especialidade: string): CoberturaResult {
  const convenio = getConvenios().find(c => c.codConvenio === codConvenio);
  const observacao = convenio?.observacao ?? '';

  if (!observacao) return { coberto: true, observacao: '' };

  const obs = observacao.toUpperCase();
  const esp = especialidade.toUpperCase();

  // Explicit "NÃO ATENDEMOS" / "NÃO REALIZAMOS" blocks
  const naoAtende = /NÃO\s+(?:ATENDEMOS|REALIZAMOS|AGENDAR)[^.]*/.exec(obs);
  if (naoAtende && naoAtende[0].includes(esp)) {
    return { coberto: false, observacao: convenio!.observacao! };
  }

  // If observacao lists covered specialties explicitly, check inclusion
  const cobreMatch = /(?:ESPECIALIDADES?|COBRE|ATENDEMOS)[^:]*:[^*\r\n]+/.exec(obs);
  if (cobreMatch) {
    const coberto = cobreMatch[0].includes(esp);
    return { coberto, observacao: convenio!.observacao! };
  }

  return { coberto: true, observacao };
}
