import { BotResponse } from '../../state/types';
import { list, MSG } from '../messages';
import { getProfissionais } from '../../base/loader';

export function buildEspecialidadeList(): BotResponse {
  const profissionais = getProfissionais();
  const especialidades = [...new Set(profissionais.flatMap(p => p.especialidades))].filter(Boolean).sort();
  return list(
    MSG.especialidadeEscolher,
    'Ver especialidades',
    [{ title: 'Especialidades', rows: especialidades.map(e => ({ id: `esp_${e}`, title: e })) }]
  );
}
