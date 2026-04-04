import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { config } from '../config';
import { BookingState } from './state';
import { matchConvenio } from '../base/convenio-matcher';

function resolveEspecialidade(nome: string): { nome: string; idProfissional: number; idsProfissionais: number[] } | null {
  const profs = getProfissionais();
  const nomeLower = nome.toLowerCase();
  const matched = profs.filter(p => p.especialidades?.some(e => e.toLowerCase().includes(nomeLower) || nomeLower.includes(e.toLowerCase())));
  if (!matched.length) return null;
  return { nome, idProfissional: matched[0].idUsuario, idsProfissionais: matched.map(p => p.idUsuario) };
}

// IDs numéricos (idPaciente, codConvenio, codPlano, idProfissional, agendamentoId, codProcedimento)
// NUNCA são extraídos do texto — só vêm de tool results passados explicitamente.
const ExtractionSchema = z.object({
  step: z.enum(['identificacao', 'convenio', 'especialidade', 'horarios', 'confirmacao', 'concluido', 'escalado']).nullable(),
  especialidadeNome: z.string().nullable(),
  particular: z.boolean().nullable().describe('true se o paciente confirmou atendimento particular (sem convênio)'),
  convenioNome: z.string().nullable().describe('nome do convênio informado pelo paciente, ex: "Amil", "Bradesco", "IAMSPE"'),
  horarioData: z.string().nullable().describe('YYYY-MM-DD se o agente apresentou UM horário específico para confirmar ou se o agendamento foi criado'),
  horarioHora: z.string().nullable().describe('HH:MM se o agente apresentou UM horário específico para confirmar ou se o agendamento foi criado'),
  horarioIntervalo: z.number().nullable().describe('intervalo em minutos do slot'),
  horarioIdProfissional: z.number().nullable().describe('id numérico do profissional do horário'),
});

function makeLlm() {
  return new ChatOpenAI({
    model: config.openai.modelExtractor,
    apiKey: config.openai.apiKey,
    configuration: { baseURL: config.openai.baseUrl },
  }).withStructuredOutput(ExtractionSchema);
}

/** Detecta se a mensagem do PACIENTE indica intenção de retomar o agendamento após escalação. */
export async function detectaRetomada(patientMsg: string): Promise<boolean> {
  try {
    const llm = new ChatOpenAI({
      model: config.openai.modelExtractor,
      apiKey: config.openai.apiKey,
      configuration: { baseURL: config.openai.baseUrl },
    }).withStructuredOutput(z.object({ querRetomar: z.boolean() }));
    const result = await llm.invoke([
      new SystemMessage(
        'O paciente estava sendo transferido para um atendente humano. ' +
        'Analise a mensagem abaixo e responda: o paciente quer retomar o agendamento de consulta com o bot? ' +
        'Responda true se a mensagem indica intenção de agendar (ex: "quero agendar", "pode marcar", "cardiologia", "particular", "sim pode", "tudo bem", "ok"). ' +
        'Responda false se é apenas uma despedida, agradecimento sem intenção de agendar, ou assunto não relacionado.'
      ),
      new HumanMessage(patientMsg),
    ]);
    return result.querRetomar;
  } catch {
    return false;
  }
}

export async function extractState(
  current: BookingState,
  agentReply: string,
  patientMsg?: string
): Promise<Partial<BookingState>> {
  try {
    const llm = makeLlm();
    const input = patientMsg
      ? `Mensagem do paciente:\n${patientMsg}\n\nResposta do agente:\n${agentReply}`
      : `Resposta do agente:\n${agentReply}`;
    const result = await llm.invoke([
      new SystemMessage(
        'Analise a conversa e extraia as informações abaixo.\n' +
        'step: "escalado" SOMENTE se o agente disse explicitamente que vai transferir/conectar com ATENDENTE HUMANO (ex: "vou te transferir para um atendente", "vou conectar com nossa equipe"). Frases como "um momento" ou "vou verificar" NÃO são escalação. "concluido" se agendamento foi criado com sucesso e confirmado ao paciente; null em todos os outros casos.\n' +
        'particular: true SOMENTE se a MENSAGEM DO PACIENTE disse explicitamente que é particular / sem convênio / não tem convênio; false ou null caso contrário. NÃO inferir a partir da resposta do agente.\n' +
        'convenioNome: nome do convênio mencionado pelo PACIENTE (ex: "Amil", "Bradesco", "IAMSPE"). Extraia SOMENTE da mensagem do paciente, nunca da resposta do agente. null se não mencionou.\n' +
        'especialidadeNome: especialidade médica mencionada pelo paciente (ex: "Cardiologia"), ou null.\n' +
        'horarioData/horarioHora/horarioIntervalo/horarioIdProfissional: preencha se o agente apresentou UM horário específico ao paciente para confirmar (ex: "17/03 às 11:50 com Dr. Jose Eduardo") OU se o agendamento foi criado com sucesso. Se o agente listou MÚLTIPLAS opções para o paciente escolher, deixe null.'
      ),
      new HumanMessage(input),
    ]);

    const update: Partial<BookingState> = {};
    if (result.step) update.step = result.step;

    // Bug 4: persistir convênio com nome quando paciente informa
    if (!current.convenio) {
      if (result.particular) {
        const p = patientMsg?.toLowerCase() ?? '';
        const mencionaParticular = /particular|sem conv[eê]nio|n[aã]o tem conv[eê]nio|n[aã]o tenho conv[eê]nio/.test(p);
        if (mencionaParticular) update.convenio = { codConvenio: -1, codPlano: -2, nome: 'Particular' };
      } else if (result.convenioNome) {
        const matched = matchConvenio(result.convenioNome);
        if (matched) {
          // convênio encontrado na base — persiste com codConvenio real
          // codPlano será definido depois quando o paciente informar o plano
          update.convenio = { codConvenio: matched.codConvenio, codPlano: matched.planos[0]?.codPlano ?? -2, nome: matched.descricaoConvenio };
        }
        // se não encontrou, não persiste — LLM vai pedir para confirmar
      }
    }
    if (result.especialidadeNome && !current.especialidade) {
      const esp = resolveEspecialidade(result.especialidadeNome);
      if (esp) update.especialidade = esp;
    }
    const isValidDate = (d: string | null) => d && d !== 'null' && /^\d{4}-\d{2}-\d{2}$/.test(d);
    const isValidTime = (h: string | null) => h && h !== 'null' && /^\d{2}:\d{2}$/.test(h);
    if (isValidDate(result.horarioData) && isValidTime(result.horarioHora) && result.horarioIdProfissional) {
      update.horario = {
        data: result.horarioData!,
        hora: result.horarioHora!,
        intervalo: result.horarioIntervalo ?? 30,
        codProcedimento: 13433,
      };
      if (current.especialidade && current.especialidade.idProfissional !== result.horarioIdProfissional) {
        update.especialidade = { ...current.especialidade, idProfissional: result.horarioIdProfissional };
      }
    }
    return update;
  } catch {
    return {};
  }
}
