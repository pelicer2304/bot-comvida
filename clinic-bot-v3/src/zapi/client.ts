import { config } from '../config';
import { BotResponse } from '../state/types';
import { logError } from '../logger';

const BASE = `https://api.z-api.io/instances/${config.zapi.instanceId}/token/${config.zapi.token}`;

const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  ...(config.zapi.clientToken ? { 'Client-Token': config.zapi.clientToken } : {}),
};

async function post(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Z-API ${endpoint} error ${res.status}: ${text}`);
  }
  return res.json();
}

async function sendText(phone: string, message: string) {
  return post('send-text', { phone, message });
}

// Converte botões em texto numerado
function buttonsToText(text: string, buttons: { id: string; label: string }[]): string {
  const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  const lines = buttons.map((b, i) => `${nums[i] || (i + 1) + '.'} ${b.label}`);
  return `${text}\n\n${lines.join('\n')}`;
}

// Converte lista em texto numerado
function listToText(text: string, sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]): string {
  const rows = sections.flatMap(s => s.rows);
  const lines = rows.map((r, i) => {
    const num = `${i + 1}.`;
    return r.description ? `${num} *${r.title}* — ${r.description}` : `${num} ${r.title}`;
  });
  return `${text}\n\n${lines.join('\n')}\n\n_Responda com o número da opção._`;
}

// Mapeia BotResponse[] → mensagens de texto via Z-API
export async function sendResponses(phone: string, responses: BotResponse[]) {
  for (const r of responses) {
    try {
      let msg = '';
      if (r.type === 'text' && r.text) {
        msg = r.text;
      } else if (r.type === 'buttons' && r.buttons.length) {
        msg = buttonsToText(r.text || '', r.buttons);
      } else if (r.type === 'list') {
        msg = listToText(r.text || '', r.sections);
      }
      if (msg.trim()) {
        await sendText(phone, msg);
      }
    } catch (e) {
      logError('zapi', 'sendResponses', e);
    }
  }
}
