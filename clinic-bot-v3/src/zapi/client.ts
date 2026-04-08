import { config } from '../config';
import { BotResponse } from '../state/types';
import { logError } from '../logger';

const BASE = `https://api.z-api.io/instances/${config.zapi.instanceId}/token/${config.zapi.token}`;

const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  ...(config.zapi.clientToken ? { 'Client-Token': config.zapi.clientToken } : {}),
};

console.log('[zapi] Client-Token presente:', !!config.zapi.clientToken);

async function post(endpoint: string, body: Record<string, unknown>) {
  const url = `${BASE}/${endpoint}`;
  console.log(`[zapi] POST ${endpoint}`, JSON.stringify(body).slice(0, 500));
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let json: Record<string, unknown> | null = null;
  try { json = JSON.parse(raw); } catch { /* não é json */ }

  if (!res.ok) {
    throw new Error(`Z-API ${endpoint} ${res.status}: ${raw}`);
  }
  // Z-API retorna 200 com {"error": "..."} em alguns casos
  if (json && typeof json.error === 'string') {
    throw new Error(`Z-API ${endpoint}: ${json.error}`);
  }
  console.log(`[zapi] ${endpoint} OK:`, raw.slice(0, 200));
  return json ?? raw;
}

// ── Envio de texto simples ────────────────────────────────────────────────────
async function sendText(phone: string, message: string) {
  return post('send-text', { phone, message });
}

// ── Envio de botões (send-button-list) ────────────────────────────────────────
// Doc Z-API: https://developer.z-api.io/message/send-button-list
async function sendButtonList(
  phone: string,
  message: string,
  btns: { id: string; label: string }[],
) {
  return post('send-button-list', {
    phone,
    message,
    buttonList: {
      buttons: btns.map(b => ({ id: b.id, label: b.label })),
    },
  });
}

// ── Envio de lista interativa (send-option-list) ──────────────────────────────
// Formato flat: cada row vira uma option direto no array
async function sendOptionList(
  phone: string,
  message: string,
  buttonLabel: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
) {
  const options = sections.flatMap(s =>
    s.rows.map(r => ({
      title: r.title,
      description: r.description ?? '',
      rowId: r.id,
    }))
  );
  const sectionTitle = sections[0]?.title ?? '';
  return post('send-option-list', {
    phone,
    message,
    optionList: { title: sectionTitle, buttonLabel, options },
  });
}

// ── Fallbacks (texto numerado) ────────────────────────────────────────────────
function buttonsToText(msg: string, btns: { id: string; label: string }[]): string {
  const lines = btns.map((b, i) => `${i + 1}. ${b.label}`);
  return `${msg}\n\n${lines.join('\n')}`;
}

function listToText(msg: string, sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]): string {
  let idx = 0;
  const parts: string[] = [];
  for (const s of sections) {
    parts.push(`*${s.title}*`);
    for (const r of s.rows) {
      idx++;
      parts.push(r.description ? `${idx}. ${r.title} - ${r.description}` : `${idx}. ${r.title}`);
    }
  }
  return `${msg}\n\n${parts.join('\n')}\n\n_Responda com o numero da opcao._`;
}

// ── Dispatcher principal ──────────────────────────────────────────────────────
export async function sendResponses(phone: string, responses: BotResponse[]) {
  for (const r of responses) {
    try {
      if (r.type === 'text' && r.text?.trim()) {
        await sendText(phone, r.text);

      } else if (r.type === 'buttons' && r.buttons.length) {
        try {
          await sendButtonList(phone, r.text || '', r.buttons);
        } catch (e) {
          console.error('[zapi] send-button-list falhou:', (e as Error).message);
          await sendText(phone, buttonsToText(r.text || '', r.buttons));
        }

      } else if (r.type === 'list' && r.sections?.length) {
        try {
          await sendOptionList(phone, r.text || '', r.buttonLabel, r.sections);
        } catch (e) {
          console.error('[zapi] send-option-list falhou:', (e as Error).message);
          await sendText(phone, listToText(r.text || '', r.sections));
        }
      }
    } catch (e) {
      logError('zapi', 'sendResponses', e);
    }
  }
}
