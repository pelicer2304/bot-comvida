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

export async function sendText(phone: string, message: string) {
  return post('send-text', { phone, message });
}

export async function sendButtons(phone: string, message: string, btns: { id: string; label: string }[]) {
  return post('send-button-list', {
    phone,
    message,
    buttonList: { buttons: btns },
  });
}

export async function sendOptionList(
  phone: string,
  message: string,
  title: string,
  buttonLabel: string,
  options: { id: string; title: string; description?: string }[]
) {
  return post('send-option-list', {
    phone,
    message,
    optionList: { title, buttonLabel, options },
  });
}

// Mapeia BotResponse[] → chamadas Z-API
export async function sendResponses(phone: string, responses: BotResponse[]) {
  for (const r of responses) {
    try {
      if (r.type === 'text' && r.text) {
        await sendText(phone, r.text);
      } else if (r.type === 'buttons' && r.buttons.length) {
        await sendButtons(phone, r.text || '⠀', r.buttons);
      } else if (r.type === 'list') {
        const title = r.sections[0]?.title || 'Opções';
        const options = r.sections.flatMap(s => s.rows);
        await sendOptionList(phone, r.text || '⠀', title, r.buttonLabel, options);
      }
    } catch (e) {
      logError('zapi', 'sendResponses', e);
    }
  }
}
