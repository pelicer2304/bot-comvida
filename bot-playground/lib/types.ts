export type BotResponse =
  | { type: 'text'; text: string }
  | { type: 'buttons'; text: string; buttons: { id: string; label: string }[] }
  | { type: 'list'; text: string; buttonLabel: string; sections: { title: string; rows: { id: string; title: string; description?: string }[] }[] };

export interface ChatEntry {
  role: 'user' | 'bot';
  content: string;
  responses?: BotResponse[];
  ts: string;
}
