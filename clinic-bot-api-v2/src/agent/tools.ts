import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { matchConvenio } from '../base/convenio-matcher';
import { getConvenios } from '../base/loader';
import { logDataAccess } from '../logger';
import { cw } from '../clinicweb/client';

let _currentThreadId = 'unknown';
export function setToolThreadId(id: string) { _currentThreadId = id; }

async function callCw(name: string, fn: () => Promise<unknown>): Promise<string> {
  const t0 = Date.now();
  const data = await fn();
  logDataAccess(_currentThreadId, 'clinicweb', name, {}, data, Date.now() - t0);
  return JSON.stringify(data);
}

export const agentTools = [
  tool(
    ({ query }) => callCw('buscar_pacientes', () => cw.buscarPacientes(query)),
    {
      name: 'buscar_pacientes',
      description: 'Busca paciente pelo CPF. Retorna dados cadastrais se encontrado.',
      schema: z.object({ query: z.string().describe('CPF do paciente, apenas números ou formatado') }),
    }
  ),
  tool(
    (args) => callCw('criar_paciente', () => cw.criarPaciente(args)),
    {
      name: 'criar_paciente',
      description: 'Cria um novo cadastro de paciente no sistema.',
      schema: z.object({
        nomeCompleto: z.string(),
        cpf: z.string(),
        dataNascimento: z.string().describe('YYYY-MM-DD'),
        sexo: z.enum(['M', 'F', 'I']),
      }),
    }
  ),
  tool(
    ({ idProfissional, diasParaFrente }) =>
      callCw('proximos_horarios_livres', () => cw.proximosHorariosLivres(idProfissional, diasParaFrente)),
    {
      name: 'proximos_horarios_livres',
      description: 'Lista os próximos horários livres de um profissional. Use diasParaFrente=7 primeiro, expanda para 15 se não houver.',
      schema: z.object({
        idProfissional: z.number().describe('ID do profissional retornado pela lista de especialidades'),
        diasParaFrente: z.number().default(7).describe('Quantos dias à frente buscar'),
      }),
    }
  ),
  tool(
    (args) => callCw('criar_agendamento', () => cw.criarAgendamento({ codProcedimento: 13433, ...args })),
    {
      name: 'criar_agendamento',
      description: 'Cria o agendamento confirmado. Chamar SOMENTE após confirmação explícita do paciente.',
      schema: z.object({
        codPaciente: z.number(),
        codProfissional: z.number(),
        data: z.string().describe('YYYY-MM-DD'),
        hora: z.string().describe('HH:MM'),
        intervalo: z.number().optional(),
        codProcedimento: z.number().default(13433).describe('ID do procedimento — padrão 13433 (Consulta em consultório). Funciona para qualquer especialidade.'),
        codConvenio: z.number().describe('-1 para particular'),
        codPlano: z.number().describe('-2 para particular'),
        codStatus: z.number().default(2),
      }),
    }
  ),
  tool(
    () => {
      const convenios = getConvenios().map(({ codConvenio, descricaoConvenio, planos }) => ({ codConvenio, descricaoConvenio, planos }));
      logDataAccess(_currentThreadId, 'base', 'listar_convenios', {}, convenios);
      return JSON.stringify(convenios);
    },
    {
      name: 'listar_convenios',
      description: 'Lista todos os convênios aceitos pela clínica. Use quando precisar confirmar se um convênio é aceito ou listar opções.',
      schema: z.object({}),
    }
  ),
  tool(
    ({ nomeConvenio }) => {
      const conv = matchConvenio(nomeConvenio);
      const output = conv
        ? { codConvenio: conv.codConvenio, nome: conv.descricaoConvenio, planos: conv.planos.map(p => ({ codPlano: p.codPlano, plano: p.plano })) }
        : { erro: `Convênio "${nomeConvenio}" não encontrado` };
      logDataAccess(_currentThreadId, 'base', 'buscar_planos_convenio', { nomeConvenio }, output);
      return JSON.stringify(output);
    },
    {
      name: 'buscar_planos_convenio',
      description: 'Busca os planos disponíveis de um convênio pelo nome. Use quando o paciente não souber o nome do plano ou pedir para listar os planos.',
      schema: z.object({
        nomeConvenio: z.string().describe('Nome do convênio informado pelo paciente, ex: "Amil", "Bradesco", "Unimed"'),
      }),
    }
  ),
];
