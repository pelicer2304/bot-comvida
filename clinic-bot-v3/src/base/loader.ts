import { readFileSync } from 'fs';
import { join } from 'path';

const BASE = join(__dirname, '../../base');

export interface Convenio {
  codConvenio: number;
  descricaoConvenio: string;
  razaoSocial: string;
  planos: { codPlano: number; plano: string }[];
  observacao: string | null;
}

export interface Profissional {
  idUsuario: number;
  nome: string;
  especialidades: string[];
}

function load<T>(file: string): T[] {
  return JSON.parse(readFileSync(join(BASE, file), 'utf-8'));
}

let _convenios: Convenio[] | null = null;
let _profissionais: Profissional[] | null = null;

export function getConvenios(): Convenio[] {
  return (_convenios ??= load<Convenio>('convenios.json'));
}

export function getProfissionais(): Profissional[] {
  return (_profissionais ??= load<Profissional>('profissionais.json'));
}
