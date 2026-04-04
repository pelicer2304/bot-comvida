// lib/tools.ts — tools OpenAI-format que espelham o MCP server

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'listar_especialidades_disponiveis',
      description: 'Retorna lista de { idProfissional, especialidades[] } com horários disponíveis agora. Use quando o paciente pedir uma especialidade — filtre pelo idProfissional correspondente e chame proximos_horarios_livres.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_profissionais',
      description: 'Lista os profissionais da clínica.',
      parameters: { type: 'object', properties: { term: { type: 'string', default: 'a' } }, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'especialidades_profissional',
      description: 'Retorna as especialidades de um profissional.',
      parameters: { type: 'object', properties: { idProfissional: { type: 'number' } }, required: ['idProfissional'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'proximos_horarios_livres',
      description: 'Busca os próximos horários disponíveis de um profissional. Use SEMPRE antes de criar agendamento.',
      parameters: {
        type: 'object',
        properties: {
          idProfissional: { type: 'number' },
          diasParaFrente: { type: 'number', default: 14 },
        },
        required: ['idProfissional'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_pacientes',
      description: 'Busca pacientes pelo CPF. Retorna idPaciente.',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'CPF do paciente' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_paciente',
      description: 'Cadastra novo paciente quando buscar_pacientes não encontrar.',
      parameters: {
        type: 'object',
        properties: {
          nomeCompleto: { type: 'string' },
          cpf: { type: 'string' },
          dataNascimento: { type: 'string', description: 'YYYY-MM-DD' },
          sexo: { type: 'string', enum: ['M', 'F', 'I'] },
          email: { type: 'string' },
          dddCelular: { type: 'string' },
          telCelular: { type: 'string' },
        },
        required: ['nomeCompleto', 'dataNascimento', 'sexo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'convenios_paciente',
      description: 'Retorna os convênios vinculados a um paciente.',
      parameters: { type: 'object', properties: { idPaciente: { type: 'number' } }, required: ['idPaciente'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_convenios',
      description: 'Lista os convênios aceitos pela clínica.',
      parameters: { type: 'object', properties: { termo: { type: 'string' } }, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_procedimentos',
      description: 'Lista os procedimentos disponíveis com seus códigos.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_agendamento',
      description: 'Cria um novo agendamento. Chame proximos_horarios_livres antes.',
      parameters: {
        type: 'object',
        properties: {
          codPaciente: { type: 'number' },
          codProfissional: { type: 'number' },
          data: { type: 'string', description: 'YYYY-MM-DD' },
          hora: { type: 'string', description: 'HH:MM' },
          codProcedimento: { type: 'number' },
          intervalo: { type: 'number', default: 30 },
          codStatus: { type: 'number', default: 2 },
          codSala: { type: 'number', default: 0 },
          codConvenio: { type: 'number', default: -1 },
          codPlano: { type: 'number', default: -2 },
          observacoes: { type: 'string' },
        },
        required: ['codPaciente', 'codProfissional', 'data', 'hora', 'codProcedimento'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelar_agendamento',
      description: 'Cancela um agendamento.',
      parameters: {
        type: 'object',
        properties: {
          codAgendamento: { type: 'number' },
          codProfissional: { type: 'number' },
        },
        required: ['codAgendamento', 'codProfissional'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_agendamentos',
      description: 'Lista agendamentos de um profissional em um período.',
      parameters: {
        type: 'object',
        properties: {
          idProfissional: { type: 'number' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
        },
        required: ['idProfissional', 'startDate', 'endDate'],
      },
    },
  },
] as const;

export type ToolName = typeof TOOLS[number]['function']['name'];
