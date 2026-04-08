import { Router } from 'express';
import { ZApiWebhookPayload } from './types';
import { sendResponses } from './client';
import { processMessage } from '../bot/engine';
import { logError } from '../logger';
import { loadSession, saveSession } from '../state/store';
import { BotResponse } from '../state/types';

export const zapiRouter = Router();

// ── Extrair input do payload Z-API ────────────────────────────────────────────
function extractInput(payload: ZApiWebhookPayload): string {
  if (payload.buttonsResponseMessage?.buttonId) return payload.buttonsResponseMessage.buttonId;
  if (payload.listResponseMessage?.selectedRowId) return payload.listResponseMessage.selectedRowId;
  if (payload.text?.message) return payload.text.message;
  return '';
}

// ── Normalizar input do usuário ───────────────────────────────────────────────
function normalizeInput(input: string): string {
  const trimmed = input.trim();
  if (/^\/clear$/i.test(trimmed)) return '/clear';
  if (/^menu$/i.test(trimmed)) return 'menu';
  if (/^voltar$/i.test(trimmed)) return 'voltar';
  return trimmed;
}

// ── Resolver IDs genéricos e numéricos ────────────────────────────────────────
async function resolveInput(phone: string, input: string): Promise<string> {
  // Se já é um ID interno não precisa resolver
  if (/^(cat_|esp_|plano_|hor_|confirmar|alterar|cancelar|convenio_|cadastrar_|retomar_|buscar_|sexo_)/.test(input)) {
    return input;
  }

  const session = await loadSession(phone);
  if (!session?.lastOptions?.length) return input;

  const opts = session.lastOptions;

  // Z-API retorna "option0", "option1" etc.
  const optMatch = input.match(/^option(\d+)$/);
  if (optMatch) {
    const idx = parseInt(optMatch[1]);
    if (idx >= 0 && idx < opts.length) return opts[idx].id;
  }

  // Resposta numérica ("1", "2")
  const num = parseInt(input);
  if (!isNaN(num) && num >= 1 && num <= opts.length) {
    return opts[num - 1].id;
  }

  // Match por label
  const lower = input.toLowerCase();
  const byLabel = opts.find(o => o.label.toLowerCase() === lower);
  if (byLabel) return byLabel.id;

  return input;
}

// ── Extrair opções das responses pra salvar ───────────────────────────────────
function extractOptions(responses: BotResponse[]): { id: string; label: string }[] {
  const opts: { id: string; label: string }[] = [];
  for (const r of responses) {
    if (r.type === 'buttons') opts.push(...r.buttons);
    if (r.type === 'list') {
      for (const s of r.sections) {
        for (const row of s.rows) {
          opts.push({ id: row.id, label: row.title });
        }
      }
    }
  }
  return opts;
}

// ── Handler principal ─────────────────────────────────────────────────────────
zapiRouter.post('/', async (req, res) => {
  const payload = req.body as ZApiWebhookPayload;
  res.sendStatus(200);

  if (payload.fromMe) return;
  if (payload.isGroup) return;
  if (payload.isNewsletter) return;
  if (payload.isEdit) return;
  if (payload.isStatusReply) return;
  if (payload.type !== 'ReceivedCallback') return;

  const phone = payload.phone;
  const rawInput = extractInput(payload);
  if (!phone || !rawInput) return;

  console.log(`[zapi] ${phone}: raw="${rawInput.slice(0, 100)}"`);

  try {
    let input = normalizeInput(rawInput);
    const resolved = await resolveInput(phone, input);
    if (resolved !== input) {
      console.log(`[zapi] ${phone}: resolved "${input}" -> "${resolved}"`);
      input = resolved;
    }

    const t0 = Date.now();
    const responses = await processMessage(phone, input);
    console.log(`[zapi] ${phone}: ${responses.length} respostas em ${Date.now() - t0}ms`);

    // Salva opções pra resolver respostas futuras (campo dedicado, não conflita com tempData)
    const opts = extractOptions(responses);
    if (opts.length) {
      const session = await loadSession(phone);
      if (session) {
        session.lastOptions = opts;
        await saveSession(session);
      }
    }

    await sendResponses(phone, responses);
    console.log(`[zapi] ${phone}: enviado`);
  } catch (e) {
    console.error(`[zapi] ${phone}: ERRO`, (e as Error).message);
    logError('zapi-webhook', 'handleMessage', e);
  }
});
