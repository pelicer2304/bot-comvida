import { BotResponse } from '../../state/types';
import { list } from '../messages';

// ── Mapeamento fixo de categorias → especialidades ────────────────────────────

export interface Categoria {
  slug: string;
  title: string;
  especialidades: string[];
}

export const CATEGORIAS: Categoria[] = [
  {
    slug: 'clinicas',
    title: 'Clinicas',
    especialidades: [
      'CLÍNICO GERAL', 'Clínica Médica', 'Cardiologia', 'Endocrinologia',
      'Gastroenterologia', 'Geriatria', 'Hematologia e Hemoterapia',
      'Reumatologia', 'Nutricionista', 'Nutrição',
    ],
  },
  {
    slug: 'exames',
    title: 'Exames e diagnostico',
    especialidades: [
      'Ecocardiografista', 'Endoscopia', 'Neurorradiologia',
      'Ultrassonografia', 'exame',
    ],
  },
  {
    slug: 'mulher-crianca',
    title: 'Mulher e crianca',
    especialidades: ['Ginecologia', 'Mastologia', 'Pediatria'],
  },
  {
    slug: 'ossos-nervos',
    title: 'Ossos e nervos',
    especialidades: ['Médico ortopedista', 'Ortopedia e Traumatologia', 'Neurologista'],
  },
  {
    slug: 'pele-olhos-ouvido',
    title: 'Pele, olhos e ouvido',
    especialidades: ['Dermatologia', 'Oftalmologia', 'Otorrinolaringologia', 'Optometrista'],
  },
  {
    slug: 'vascular',
    title: 'Vascular',
    especialidades: ['Angiologia', 'Cirurgia Vascular'],
  },
  {
    slug: 'outras',
    title: 'Outras especialidades',
    especialidades: ['Psicologia', 'Psiquiatria', 'Urologia', 'Outra'],
  },
];

// Mapa reverso: slug da especialidade → nome real (pra resolver IDs)
const _espSlugMap = new Map<string, string>();
for (const cat of CATEGORIAS) {
  for (const esp of cat.especialidades) {
    _espSlugMap.set(toSlug(esp), esp);
  }
}

export function toSlug(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function resolveEspSlug(slug: string): string | undefined {
  return _espSlugMap.get(slug);
}

export function findCategoriaBySlug(slug: string): Categoria | undefined {
  return CATEGORIAS.find(c => c.slug === slug);
}

// ── Builders de lista ─────────────────────────────────────────────────────────

export function buildCategoriaList(): BotResponse {
  return list(
    'Qual area voce precisa?',
    'Ver categorias',
    [{
      title: 'Categorias',
      rows: CATEGORIAS.map(c => ({
        id: `cat_${c.slug}`,
        title: c.title,
      })),
    }],
  );
}

export function buildEspecialidadeList(cat: Categoria): BotResponse {
  return list(
    'Qual especialidade voce precisa?',
    'Ver especialidades',
    [{
      title: 'Especialidades',
      rows: cat.especialidades.map(e => ({
        id: `esp_${toSlug(e)}`,
        title: e,
      })),
    }],
  );
}
