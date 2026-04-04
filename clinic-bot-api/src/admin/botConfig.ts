import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const CONFIG_PATH = join(process.cwd(), 'src', 'config', 'bot-config.json');

const DEFAULT_CONFIG = {
  botAtivo: true,
  mensagemBoasVindas: 'Olá! Sou a assistente da Clínica ComVida. Como posso ajudar?',
  mensagemForaHorario: 'Nosso atendimento é de segunda a sexta, das 8h às 18h. Retornaremos em breve!',
  maxTentativasPorStep: 3,
  debounceMs: 4000,
  horarioAtendimento: {
    segunda:  { ativo: true,  inicio: '08:00', fim: '18:00' },
    terca:    { ativo: true,  inicio: '08:00', fim: '18:00' },
    quarta:   { ativo: true,  inicio: '08:00', fim: '18:00' },
    quinta:   { ativo: true,  inicio: '08:00', fim: '18:00' },
    sexta:    { ativo: true,  inicio: '08:00', fim: '18:00' },
    sabado:   { ativo: false, inicio: '08:00', fim: '12:00' },
    domingo:  { ativo: false, inicio: '08:00', fim: '12:00' },
  },
};

export function getBotConfig() {
  if (!existsSync(CONFIG_PATH)) return DEFAULT_CONFIG;
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
}

export function saveBotConfig(data: object) {
  const current = getBotConfig();
  const updated = { ...current, ...data };
  writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
  return updated;
}
