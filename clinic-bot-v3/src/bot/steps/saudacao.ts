import { StepHandler } from '../../state/types';
import { text, buttons, MSG } from '../messages';

export const saudacaoStep: StepHandler = async (_session, _input) => {
  return {
    responses: [text(MSG.saudacao)],
    stateUpdate: { step: 'identificacao', subStep: 'aguardando_cpf' },
  };
};
