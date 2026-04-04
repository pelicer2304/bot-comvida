// index.js — MCP server HTTP/SSE para ClinicWeb
import 'dotenv/config';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { cw } from './clinicweb.js';

const app = express();
app.use(express.json());

// Health check (sem auth)
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'clinicweb-mcp' }));

// Proteção básica por API key (apenas /sse e /messages)
app.use(['/sse', '/messages'], (req, res, next) => {
  const key = process.env.MCP_API_KEY;
  if (key && req.headers['x-api-key'] !== key) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// ── MCP Server ────────────────────────────────────────────────────────────────
function createMcpServer() {
  const server = new McpServer({
    name: 'clinicweb',
    version: '1.0.0',
  });

  const ok = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
  const err = (e) => { throw new Error(e.message); };

  // ── Profissionais ──────────────────────────────────────────────────────────
  server.tool('listar_profissionais',
    'Lista os profissionais da clínica. Use para mostrar opções ao paciente.',
    { term: z.string().min(1).default('a').describe('Termo de busca (mín 1 char)') },
    async ({ term }) => ok(await cw.listarProfissionais(term)).catch(err)
  );

  server.tool('especialidades_profissional',
    'Retorna as especialidades de um profissional (ex: Cardiologia, Dermatologia).',
    { idProfissional: z.number().describe('ID do profissional') },
    async ({ idProfissional }) => ok(await cw.especialidadesProfissional(idProfissional)).catch(err)
  );

  server.tool('proximos_horarios_livres',
    'Busca os próximos horários disponíveis de um profissional nos próximos dias. Use SEMPRE antes de criar um agendamento.',
    {
      idProfissional: z.number().describe('ID do profissional'),
      diasParaFrente: z.number().min(1).max(30).default(14).describe('Quantos dias à frente buscar'),
    },
    async ({ idProfissional, diasParaFrente }) =>
      ok(await cw.proximosHorariosLivres(idProfissional, diasParaFrente)).catch(err)
  );

  server.tool('horarios_livres',
    'Busca horários livres de um profissional em uma data específica.',
    {
      idProfissional: z.number(),
      data:    z.string().describe('Data no formato YYYY-MM-DD'),
      dataFim: z.string().optional().describe('Data fim (YYYY-MM-DD). Padrão: data + 1 dia'),
    },
    async ({ idProfissional, data, dataFim }) =>
      ok(await cw.horariosLivres(idProfissional, data, dataFim)).catch(err)
  );

  // ── Agendamentos ───────────────────────────────────────────────────────────
  server.tool('listar_agendamentos',
    'Lista os agendamentos de um profissional em um período.',
    {
      idProfissional: z.number(),
      startDate: z.string().describe('YYYY-MM-DD'),
      endDate:   z.string().describe('YYYY-MM-DD'),
    },
    async ({ idProfissional, startDate, endDate }) =>
      ok(await cw.listarAgendamentos(idProfissional, startDate, endDate)).catch(err)
  );

  server.tool('buscar_agendamento',
    'Retorna os dados completos de um agendamento pelo ID.',
    { codAgendamento: z.number() },
    async ({ codAgendamento }) => ok(await cw.buscarAgendamento(codAgendamento)).catch(err)
  );

  server.tool('criar_agendamento',
    'Cria um novo agendamento. IMPORTANTE: chame proximos_horarios_livres antes para garantir que o horário está disponível. codPaciente deve ser o idPaciente retornado por buscar_pacientes.',
    {
      codPaciente:     z.number().describe('idPaciente retornado por buscar_pacientes'),
      codProfissional: z.number(),
      data:            z.string().describe('YYYY-MM-DD'),
      hora:            z.string().describe('HH:MM'),
      codProcedimento: z.number().describe('ID do procedimento (use listar_procedimentos)'),
      intervalo:       z.number().optional().default(30),
      codStatus:       z.number().optional().default(2).describe('2=Confirmado'),
      codSala:         z.number().optional().default(0),
      codConvenio:     z.number().optional().default(-1).describe('-1=Particular'),
      codPlano:        z.number().optional().default(-2).describe('-2=Particular'),
      observacoes:     z.string().optional(),
    },
    async (args) => ok(await cw.criarAgendamento(args)).catch(err)
  );

  server.tool('alterar_status_agendamento',
    'Altera o status de um agendamento. 0=Cancelado, 1=Aguarda atendimento, 2=Confirmado, 3=Não chegou.',
    {
      codAgendamento: z.number(),
      idStatus:       z.number().min(0).max(3),
    },
    async ({ codAgendamento, idStatus }) =>
      ok(await cw.alterarStatusAgendamento(codAgendamento, idStatus)).catch(err)
  );

  server.tool('cancelar_agendamento',
    'Remove/cancela um agendamento.',
    {
      codAgendamento:  z.number(),
      codProfissional: z.number(),
    },
    async ({ codAgendamento, codProfissional }) =>
      ok(await cw.cancelarAgendamento(codAgendamento, codProfissional)).catch(err)
  );

  server.tool('dias_bloqueados',
    'Lista os dias bloqueados na agenda de um profissional.',
    {
      idProfissional: z.number(),
      data: z.string().describe('YYYY-MM-DD'),
    },
    async ({ idProfissional, data }) =>
      ok(await cw.diasBloqueados(idProfissional, data)).catch(err)
  );

  server.tool('listar_status_agendamento',
    'Lista todos os status possíveis de agendamento com suas descrições e cores.',
    {},
    async () => ok(await cw.listarStatus()).catch(err)
  );

  // ── Pacientes ──────────────────────────────────────────────────────────────
  server.tool('buscar_pacientes',
    'Busca pacientes pelo nome ou CPF. Retorna idPaciente que deve ser usado em criar_agendamento.',
    { query: z.string().min(3).describe('Nome ou CPF (mín 3 chars)') },
    async ({ query }) => ok(await cw.buscarPacientes(query)).catch(err)
  );

  server.tool('criar_paciente',
    'Cadastra um novo paciente. Use quando buscar_pacientes não encontrar o paciente.',
    {
      nomeCompleto:    z.string().describe('Nome completo'),
      cpf:             z.string().optional(),
      dataNascimento:  z.string().describe('YYYY-MM-DD'),
      sexo:            z.enum(['M', 'F', 'I']),
      email:           z.string().email().optional(),
      dddCelular:      z.string().optional(),
      telCelular:      z.string().optional(),
    },
    async (args) => ok(await cw.criarPaciente(args)).catch(err)
  );

  server.tool('convenios_paciente',
    'Retorna os convênios vinculados a um paciente. Use para pré-selecionar o convênio no agendamento.',
    { idPaciente: z.number().describe('idPaciente retornado por buscar_pacientes') },
    async ({ idPaciente }) => ok(await cw.conveniosPaciente(idPaciente)).catch(err)
  );

  // ── Empresa ────────────────────────────────────────────────────────────────
  server.tool('listar_convenios',
    'Lista os convênios aceitos pela clínica.',
    { termo: z.string().optional().describe('Filtro por nome do convênio') },
    async ({ termo }) => ok(await cw.listarConvenios(termo)).catch(err)
  );

  server.tool('listar_procedimentos',
    'Lista os grupos de procedimentos e seus códigos. Use para obter codProcedimento para criar_agendamento.',
    {},
    async () => ok(await cw.listarProcedimentos()).catch(err)
  );

  server.tool('listar_salas',
    'Lista as salas disponíveis. codSala=0 é a Sala Padrão.',
    {},
    async () => ok(await cw.listarSalas()).catch(err)
  );

  return server;
}

// ── REST /tool — usado pelo chat-ui para chamar tools diretamente ───────────────
app.post('/tool', async (req, res) => {
  const key = process.env.MCP_API_KEY;
  if (key && req.headers['x-api-key'] !== key)
    return res.status(401).json({ error: 'Unauthorized' });

  const { tool, args } = req.body;
  const toolHandlers = {
    listar_especialidades_disponiveis: async () => {
      const profs = await cw.listarProfissionais('a');
      const lista = Array.isArray(profs) ? profs : profs?.data ?? [];
      const resultados = await Promise.all(
        lista.map(async (p) => {
          const id = p.idUsuario;
          try {
            const horarios = await cw.proximosHorariosLivres(id, 14);
            if (!horarios?.length) return null;
            const esps = await cw.especialidadesProfissional(id);
            const especialidades = (Array.isArray(esps) ? esps : esps?.data ?? [])
              .map(e => e.Especialidade?.descri || e.descri)
              .filter(Boolean);
            return especialidades.length ? { idProfissional: id, especialidades } : null;
          } catch { return null; }
        })
      );
      return resultados.filter(Boolean);
    },
    listar_profissionais:       () => cw.listarProfissionais(args.term),
    especialidades_profissional: () => cw.especialidadesProfissional(args.idProfissional),
    proximos_horarios_livres:   () => cw.proximosHorariosLivres(args.idProfissional, args.diasParaFrente).then(h => (h || []).slice(0, 20)),
    horarios_livres:            () => cw.horariosLivres(args.idProfissional, args.data, args.dataFim),
    listar_agendamentos:        () => cw.listarAgendamentos(args.idProfissional, args.startDate, args.endDate),
    buscar_agendamento:         () => cw.buscarAgendamento(args.codAgendamento),
    criar_agendamento:          () => cw.criarAgendamento({ codProcedimento: 13433, ...args }),
    alterar_status_agendamento: () => cw.alterarStatusAgendamento(args.codAgendamento, args.idStatus),
    cancelar_agendamento:       () => cw.cancelarAgendamento(args.codAgendamento, args.codProfissional),
    dias_bloqueados:            () => cw.diasBloqueados(args.idProfissional, args.data),
    listar_status_agendamento:  () => cw.listarStatus(),
    buscar_pacientes:           () => cw.buscarPacientes(args.query),
    criar_paciente:             () => cw.criarPaciente(args),
    convenios_paciente:         () => cw.conveniosPaciente(args.idPaciente),
    listar_convenios:           () => cw.listarConvenios(args.termo),
    listar_procedimentos:       () => cw.listarProcedimentos(),
    listar_salas:               () => cw.listarSalas(),
  };

  const handler = toolHandlers[tool];
  if (!handler) return res.status(400).json({ error: `Tool desconhecida: ${tool}` });

  try {
    const result = await handler();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── SSE transport (compatível com n8n MCP Client) ─────────────────────────────
const transports = {};

app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  res.on('close', () => delete transports[transport.sessionId]);
  const server = createMcpServer();
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (!transport) return res.status(404).json({ error: 'Session not found' });
  await transport.handlePostMessage(req, res, req.body);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`clinicweb-mcp rodando em http://localhost:${PORT}`));
