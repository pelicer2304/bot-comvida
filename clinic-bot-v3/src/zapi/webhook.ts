import { Router } from 'express';
import { ZApiWebhookPayload } from './types';
import { sendResponses } from './client';
import { processMessage } from '../bot/engine';
import { logMessage, logError } from '../logger';

export const zapiRouter = Router();

function extractInput(payload: ZApiWebhookPayload): string {
  if (payload.buttonsResponseMessage?.buttonId) return payload.buttonsResponseMessage.buttonId;
  if (payload.listResponseMessage?.selectedRowId) return payload.listResponseMessage.selectedRowId;
  if (payload.text?.message) return payload.text.message;
  return '';
}

zapiRouter.post('/', async (req, res) => {
  const payload = req.body as ZApiWebhookPayload;

  // Responde 200 imediatamente
  res.sendStatus(200);

  // Ignora: mensagens próprias, grupos, newsletters, edições, status replies
  if (payload.fromMe) return;
  if (payload.isGroup) return;
  if (payload.isNewsletter) return;
  if (payload.isEdit) return;
  if (payload.isStatusReply) return;
  if (payload.type !== 'ReceivedCallback') return;

  const phone = payload.phone;
  const input = extractInput(payload);
  if (!phone || !input) return;

  try {
    logMessage(phone, 'user', input);
    const responses = await processMessage(phone, input);
    await sendResponses(phone, responses);
  } catch (e) {
    logError('zapi-webhook', 'handleMessage', e);
  }
});
