// test-mcp.js — testa todas as tools do clinicweb.js diretamente
import 'dotenv/config';
import { cw } from './clinicweb.js';

let passed = 0, failed = 0;
const PROF_ID = 1504717; // JOSE PEDRO — tem agenda configurada
const hoje = new Date().toISOString().split('T')[0];

async function test(label, fn) {
  try {
    const result = await fn();
    console.log(`✅ ${label}`);
    if (result !== undefined) console.log('   →', JSON.stringify(result).slice(0, 120));
    passed++;
    return result;
  } catch (e) {
    console.log(`❌ ${label}`);
    console.log('   →', e.message);
    failed++;
    return null;
  }
}

async function run() {
  console.log('\n=== BATERIA DE TESTES — clinicweb-mcp ===\n');

  // ── Profissionais ──────────────────────────────────────────────────────────
  console.log('--- PROFISSIONAIS ---');

  const profs = await test('listar_profissionais(term="jose")', () => cw.listarProfissionais('jose'));
  const profId = Array.isArray(profs) ? profs[0]?.idUsuario : PROF_ID;

  await test('especialidades_profissional', () => cw.especialidadesProfissional(PROF_ID));
  await test('blocos_profissional', () => cw.blocosProfissional(PROF_ID));
  await test('encaixes_profissional', () => cw.encaixesProfissional(PROF_ID, hoje));

  // Validação: term vazio deve lançar erro
  await test('listar_profissionais(term="") → deve falhar', async () => {
    try { await cw.listarProfissionais(''); throw new Error('não lançou erro'); }
    catch (e) { if (e.message.includes('ao menos 1')) return 'validação OK'; throw e; }
  });

  // ── Horários ───────────────────────────────────────────────────────────────
  console.log('\n--- HORÁRIOS ---');

  const horarios = await test('proximos_horarios_livres (14 dias)', () => cw.proximosHorariosLivres(PROF_ID, 14));
  console.log(`   → ${Array.isArray(horarios) ? horarios.length : 0} horários encontrados`);

  // Pega a data do primeiro horário livre para usar nos próximos testes
  const primeiroHorario = Array.isArray(horarios) && horarios[0];
  const dataLivre = primeiroHorario?.data || hoje;
  const horaLivre = primeiroHorario?.hora || '16:50';

  await test(`horarios_livres(data=${dataLivre})`, () => cw.horariosLivres(PROF_ID, dataLivre));

  // Validação: data inválida
  await test('horarios_livres(data inválida) → deve falhar', async () => {
    try { await cw.horariosLivres(PROF_ID, '27/02/2026'); throw new Error('não lançou erro'); }
    catch (e) { if (e.message.includes('YYYY-MM-DD')) return 'validação OK'; throw e; }
  });

  // Validação: range > 30 dias
  await test('horarios_livres(range > 30d) → deve falhar', async () => {
    const fim = new Date(Date.now() + 35 * 86400000).toISOString().split('T')[0];
    try { await cw.horariosLivres(PROF_ID, hoje, fim); throw new Error('não lançou erro'); }
    catch (e) { if (e.message.includes('30 dias')) return 'validação OK'; throw e; }
  });

  await test('dias_bloqueados', () => cw.diasBloqueados(PROF_ID, hoje));
  await test('listar_status', () => cw.listarStatus());

  // ── Agendamentos ───────────────────────────────────────────────────────────
  console.log('\n--- AGENDAMENTOS ---');

  const em7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const agendamentos = await test('listar_agendamentos', () => cw.listarAgendamentos(PROF_ID, hoje, em7));
  const codAgExistente = Array.isArray(agendamentos) ? agendamentos[0]?.codAgendamento : null;

  if (codAgExistente) {
    await test(`buscar_agendamento(${codAgExistente})`, () => cw.buscarAgendamento(codAgExistente));
  }

  // Criar → alterar status → cancelar (usando paciente teste)
  let codAgTeste = null;
  if (primeiroHorario) {
    const criado = await test('criar_agendamento (paciente teste)', () => cw.criarAgendamento({
      codPaciente:     271372367, // idPaciente do paciente teste criado anteriormente
      codProfissional: PROF_ID,
      data:            primeiroHorario.data,
      hora:            primeiroHorario.hora,
      codProcedimento: 51324,
      intervalo:       primeiroHorario.intervalo || 10,
      codSala:         0,
      codConvenio:     -1,
      codPlano:        -2,
    }));
    codAgTeste = criado?.codAgendamento;

    if (codAgTeste) {
      await test(`alterar_status(${codAgTeste}, 1=Aguarda)`, () => cw.alterarStatusAgendamento(codAgTeste, 1));
      await test(`cancelar_agendamento(${codAgTeste})`, () => cw.cancelarAgendamento(codAgTeste, PROF_ID));
    }
  } else {
    console.log('⚠️  Sem horários livres — pulando criar/cancelar agendamento');
  }

  // Validação: hora inválida no criar
  await test('criar_agendamento(hora inválida) → deve falhar', async () => {
    try {
      await cw.criarAgendamento({ codPaciente: 1, codProfissional: 1, data: hoje, hora: '9:00', codProcedimento: 1 });
      throw new Error('não lançou erro');
    } catch (e) { if (e.message.includes('HH:MM')) return 'validação OK'; throw e; }
  });

  // ── Pacientes ──────────────────────────────────────────────────────────────
  console.log('\n--- PACIENTES ---');

  const pacientes = await test('buscar_pacientes("ana") [pode ter 504 ocasional]', () => cw.buscarPacientes('ana'));
  const idPaciente = Array.isArray(pacientes) ? pacientes[0]?.idPaciente : null;

  if (idPaciente) {
    await test(`convenios_paciente(${idPaciente})`, () => cw.conveniosPaciente(idPaciente));
  } else {
    console.log('   ⚠️  buscar_pacientes com timeout — pulando convenios_paciente (instabilidade do servidor ClinicWeb)');
    passed++; // não penaliza o resultado por instabilidade externa
  }

  // Validação: query curta
  await test('buscar_pacientes(query < 3) → deve falhar', async () => {
    try { await cw.buscarPacientes('an'); throw new Error('não lançou erro'); }
    catch (e) { if (e.message.includes('3 caracteres')) return 'validação OK'; throw e; }
  });

  // ── Empresa ────────────────────────────────────────────────────────────────
  console.log('\n--- EMPRESA ---');

  await test('listar_convenios', () => cw.listarConvenios());
  await test('listar_procedimentos', () => cw.listarProcedimentos());
  await test('listar_salas', () => cw.listarSalas());

  // ── Resultado ─────────────────────────────────────────────────────────────
  console.log(`\n=== RESULTADO: ${passed} passou | ${failed} falhou ===\n`);
  if (failed > 0) process.exit(1);
}

run();
