import { StepHandler } from '../../state/types';
import { text, buttons, MSG } from '../messages';
import { cw } from '../../clinicweb/client';
import { logError } from '../../logger';

function extractCpf(input: string): string | null {
  const match = input.replace(/\s/g, '').match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11}/);
  return match ? match[0].replace(/\D/g, '') : null;
}

function extractDate(input: string): string | null {
  const withSep = input.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (withSep) return `${withSep[3]}-${withSep[2]}-${withSep[1]}`;
  const noSep = input.match(/\b(\d{2})(\d{2})(\d{4})\b/);
  if (noSep) return `${noSep[3]}-${noSep[2]}-${noSep[1]}`;
  return null;
}

export const identificacaoStep: StepHandler = async (session, input) => {
  const { subStep, tentativas } = session;

  // Aguardando CPF
  if (subStep === 'aguardando_cpf') {
    const cpf = extractCpf(input);
    if (!cpf) {
      const t = (tentativas.cpf ?? 0) + 1;
      if (t >= 2) {
        return {
          responses: [text(MSG.cpfEscalado)],
          stateUpdate: { step: 'escalado', tentativas: { ...tentativas, cpf: t } },
        };
      }
      return {
        responses: [text(MSG.cpfInvalido)],
        stateUpdate: { tentativas: { ...tentativas, cpf: t } },
      };
    }

    try {
      const pacientes = await cw.buscarPacientes(cpf);
      const paciente = Array.isArray(pacientes) ? pacientes[0] : null;

      if (paciente?.nome) {
        return {
          responses: [buttons(MSG.confirmarPaciente(paciente.nome), [
            { id: 'confirmar_sim', label: 'Sim' },
            { id: 'confirmar_nao', label: 'Não' },
          ])],
          stateUpdate: {
            subStep: 'confirmar_paciente',
            tempData: { paciente, cpf },
          },
        };
      }
    } catch (e) {
      logError('identificacao', 'buscarPacientes', e);
    }

    // CPF válido mas não encontrado — oferece cadastro (não conta como tentativa)
    return {
      responses: [buttons(MSG.cpfNaoEncontrado, [
        { id: 'cadastrar_sim', label: 'Cadastrar' },
        { id: 'cadastrar_nao', label: 'Falar com atendente' },
      ])],
      stateUpdate: {
        subStep: 'aguardando_cadastro',
        tempData: { cpf },
      },
    };
  }

  // Confirmar paciente encontrado
  if (subStep === 'confirmar_paciente') {
    if (input === 'confirmar_sim' || /^s/i.test(input)) {
      const p = session.tempData?.paciente as { idPaciente: number; nome: string; dataNascimento: string };
      const cpf = session.tempData?.cpf as string;
      return {
        responses: [buttons(MSG.pacienteConfirmado(p.nome), [
          { id: 'convenio_sim', label: 'Sim, tenho convênio' },
          { id: 'convenio_particular', label: 'Particular' },
        ])],
        stateUpdate: {
          step: 'convenio',
          subStep: 'escolher_tipo',
          paciente: { idPaciente: p.idPaciente, nome: p.nome, cpf, dataNascimento: p.dataNascimento },
          tempData: undefined,
        },
      };
    }
    return {
      responses: [text('Pode me informar o CPF correto para que eu tente novamente.')],
      stateUpdate: { subStep: 'aguardando_cpf', tempData: undefined },
    };
  }

  // Aguardando decisão de cadastro
  if (subStep === 'aguardando_cadastro') {
    if (input === 'cadastrar_sim' || /^s/i.test(input) || /cadastr/i.test(input)) {
      return {
        responses: [text(MSG.cadastroNome)],
        stateUpdate: { subStep: 'cadastro_nome' },
      };
    }
    return {
      responses: [text(MSG.escalado)],
      stateUpdate: { step: 'escalado' },
    };
  }

  // Cadastro: nome
  if (subStep === 'cadastro_nome') {
    const nome = input.trim();
    if (nome.length < 3 || nome.split(' ').length < 2) {
      return {
        responses: [text('Por favor, informe seu *nome completo* (nome e sobrenome).')],
        stateUpdate: {},
      };
    }
    return {
      responses: [text(MSG.cadastroNascimento)],
      stateUpdate: { subStep: 'cadastro_nascimento', tempData: { ...session.tempData, nome } },
    };
  }

  // Cadastro: data nascimento
  if (subStep === 'cadastro_nascimento') {
    const data = extractDate(input);
    if (!data) {
      return {
        responses: [text('Por favor, informe no formato *DD/MM/AAAA*.')],
        stateUpdate: {},
      };
    }
    return {
      responses: [buttons(MSG.cadastroSexo, [
        { id: 'sexo_M', label: 'Masculino' },
        { id: 'sexo_F', label: 'Feminino' },
      ])],
      stateUpdate: { subStep: 'cadastro_sexo', tempData: { ...session.tempData, dataNascimento: data } },
    };
  }

  // Cadastro: sexo
  if (subStep === 'cadastro_sexo') {
    let sexo: 'M' | 'F' = 'M';
    if (input === 'sexo_F' || /fem/i.test(input)) sexo = 'F';

    const { cpf, nome, dataNascimento } = session.tempData as { cpf: string; nome: string; dataNascimento: string };

    try {
      const result = await cw.criarPaciente({ nomeCompleto: nome, cpf, dataNascimento, sexo });

      return {
        responses: [buttons(MSG.cadastroSucesso, [
          { id: 'convenio_sim', label: 'Sim, tenho convênio' },
          { id: 'convenio_particular', label: 'Particular' },
        ])],
        stateUpdate: {
          step: 'convenio',
          subStep: 'escolher_tipo',
          paciente: { idPaciente: result.idPaciente, nome, cpf, dataNascimento },
          tempData: undefined,
        },
      };
    } catch (e) {
      logError('identificacao', 'criarPaciente', e);
      return {
        responses: [text(MSG.cadastroErro)],
        stateUpdate: { step: 'escalado', tempData: undefined },
      };
    }
  }

  // Fallback
  return {
    responses: [text(MSG.saudacao)],
    stateUpdate: { subStep: 'aguardando_cpf' },
  };
};
