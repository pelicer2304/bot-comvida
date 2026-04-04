import Fuse from 'fuse.js';
import { getConvenios, type Convenio } from './loader';

let _fuse: Fuse<Convenio> | null = null;

function getFuse(): Fuse<Convenio> {
  if (!_fuse) {
    _fuse = new Fuse(getConvenios(), {
      keys: ['descricaoConvenio', 'razaoSocial'],
      threshold: 0.4,
      ignoreLocation: true,
    });
  }
  return _fuse;
}

export function matchConvenio(nome: string): Convenio | null {
  return getFuse().search(nome)[0]?.item ?? null;
}
