import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CONVENIOS_PATH = join(process.cwd(), 'base', 'convenios.json');

export function getConvenios() {
  return JSON.parse(readFileSync(CONVENIOS_PATH, 'utf-8'));
}

export function patchConvenio(codConvenio: number, observacao: string) {
  const list = getConvenios();
  const idx = list.findIndex((c: { codConvenio: number }) => c.codConvenio === codConvenio);
  if (idx === -1) throw new Error('Convênio não encontrado');
  list[idx].observacao = observacao;
  writeFileSync(CONVENIOS_PATH, JSON.stringify(list, null, 2));
  return list[idx];
}
