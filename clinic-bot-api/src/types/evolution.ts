// src/types/evolution.ts

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text: string };
    };
    messageType: string;
    messageTimestamp: number;
  };
}

export interface EvolutionSendTextPayload {
  number: string;
  text: string;
}
