import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { config } from '../config';
import { readFileSync } from 'fs';
import { join } from 'path';

const BASE_DIR = join(__dirname, '../../base');

function readBase<T>(file: string): T {
  return JSON.parse(readFileSync(join(BASE_DIR, file), 'utf-8')) as T;
}

interface Plano { codPlano: number; plano: string; }
interface Convenio { codConvenio: number; descricaoConvenio: string; planos: Plano[]; observacao?: string; }
interface Profissional { idUsuario: number; nome: string; especialidades: string[]; }

async function callMcp(name: string, args: Record<string, unknown>) {
  const res = await fetch(`${config.mcp.url}/tool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': config.mcp.apiKey },
    body: JSON.stringify({ tool: name, args }),
  });
  if (!res.ok) throw new Error(`MCP error ${res.status}`);
  const data = await res.json() as unknown;
  return typeof data === 'string' ? data : JSON.stringify(data);
}

export const buscarPacientes = tool(
  ({ cpf }) => callMcp('buscar_pacientes', { query: cpf }),
  {
    name: 'buscar_pacientes',
    description: 'Busca paciente pelo CPF',
    schema: z.object({ cpf: z.string() }),
  }
);

export const listarEspecialidadesDisponiveis = tool(
  () => {
    const profissionais = readBase<Profissional[]>('profissionais.json');
    const especialidades = new Map<string, number[]>();
    for (const p of profissionais) {
      for (const esp of p.especialidades) {
        if (!especialidades.has(esp)) especialidades.set(esp, []);
        especialidades.get(esp)!.push(p.idUsuario);
      }
    }
    return Promise.resolve(JSON.stringify(
      [...especialidades.entries()].map(([especialidade, idsProfissional]) => ({ especialidade, idsProfissional }))
    ));
  },
  {
    name: 'listar_especialidades_disponiveis',
    description: 'Lista especialidades disponíveis e os idProfissional correspondentes',
    schema: z.object({}),
  }
);

export const listarConvenios = tool(
  () => {
    const convenios = readBase<Convenio[]>('convenios.json');
    return Promise.resolve(JSON.stringify(
      convenios.map(({ codConvenio, descricaoConvenio, planos }) => ({ codConvenio, descricaoConvenio, planos }))
    ));
  },
  {
    name: 'listar_convenios',
    description: 'Lista todos os convênios aceitos pela clínica com seus planos',
    schema: z.object({}),
  }
);

export const buscarPlanosConvenio = tool(
  ({ nomeConvenio }) => {
    const convenios = readBase<Convenio[]>('convenios.json');
    const termo = nomeConvenio.toLowerCase();
    const encontrados = convenios.filter(c => c.descricaoConvenio.toLowerCase().includes(termo));
    if (!encontrados.length) return Promise.resolve(`Nenhum convênio encontrado para "${nomeConvenio}"`);
    return Promise.resolve(JSON.stringify(
      encontrados.map(({ codConvenio, descricaoConvenio, planos, observacao }) => ({ codConvenio, descricaoConvenio, planos, observacao }))
    ));
  },
  {
    name: 'buscar_planos_convenio',
    description: 'Busca convênio pelo nome e retorna seus planos e cobertura',
    schema: z.object({ nomeConvenio: z.string() }),
  }
);

export const proximosHorariosLivres = tool(
  ({ idProfissional, idConvenio, idPaciente }) =>
    callMcp('proximos_horarios_livres', { idProfissional, idConvenio, idPaciente }),
  {
    name: 'proximos_horarios_livres',
    description: 'Lista os próximos horários livres para agendamento',
    schema: z.object({
      idProfissional: z.number(),
      idConvenio: z.number(),
      idPaciente: z.number(),
    }),
  }
);

export const criarAgendamento = tool(
  (args) => callMcp('criar_agendamento', args),
  {
    name: 'criar_agendamento',
    description: 'Cria um agendamento confirmado',
    schema: z.object({
      idProfissional: z.number(),
      idPaciente: z.number(),
      idConvenio: z.number(),
      dataHora: z.string(),
    }),
  }
);

export const agentTools = [
  buscarPacientes,
  listarEspecialidadesDisponiveis,
  listarConvenios,
  buscarPlanosConvenio,
  proximosHorariosLivres,
  criarAgendamento,
];
