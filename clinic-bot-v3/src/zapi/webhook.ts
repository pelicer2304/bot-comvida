import { Router } from 'express';
import { ZApiWebhookPayload } from './types';
import { sendResponses } from './client';
import { processMessage } from '../bot/engine';
import { logError } from '../logger';
import { loadSession } from '../state/store';

export const zapiRouter = Router();

function extractInput(payload: ZApiWebhookPayload): string {
  if (payload.buttonsResponseMessage?.buttonId) return payload.buttonsResponseMessage.buttonId;
  if (payload.listResponseMessage?.selectedRowId) return payload.listResponseMessage.selectedRowId;
  if (payload.text?.message) return payload.text.message;
  return '';
}

// Mapeia resposta numérica ("1", "2") pro ID da última opção enviada
async function resolveNumericInput(phone: string, input: string): Promise<string> {
  const num = parseInt(input.trim());
  if (isNaN(num) || num < 1) return input;

  const session = await loadSession(phone);
  if (!session) return input;

  // Busca as últimas opções no tempData ou no estado
  const lastOptions = session.tempData?.lastOptions as { id: string; label: string }[] | undefined;
  if (lastOptions && num <= lastOptions.length) {
    return lastOptions[num - 1].id;
  }

  return input;
}

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
  let input = extractInput(payload);
  if (!phone || !input) return;

  console.log(`[zapi] ${phone}: "${input.slice(0, 100)}"`);

  try {
    // Resolve "1", "2" → ID do botão/lista
    input = await resolveNumericInput(phone, input);
    if (input !== extractInput(payload)) {
      console.log(`[zapi] ${phone}: resolved → "${input}"`);
    }

    const t0 = Date.now();
    const responses = await processMessage(phone, input);
    console.log(`[zapi] ${phone}: ${responses.length} respostas em ${Date.now() - t0}ms`);

    // Salva as opções enviadas pra resolver respostas numéricas
    const allOptions: { id: string; label: string }[] = [];
    for (const r of responses) {
      if (r.type === 'buttons') allOptions.push(...r.buttons);
      if (r.type === 'list') r.sections.forEach(s => s.rows.forEach(row => allOptions.push({ id: row.id, label: row.title })));
    }
    if (allOptions.length) {
      const session = await loadSession(phone);
      if (session) {
        session.tempData = { ...session.tempData, lastOptions: allOptions };
        const { saveSession } = await import('../state/store');
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
