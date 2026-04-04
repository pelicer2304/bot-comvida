import { Router, Request, Response } from 'express';
import { config } from '../config';
import { sendText } from './evolution-client';
import { invokeAgent, clearThread } from '../agent/graph';
import type { EvolutionWebhookPayload } from '../types/evolution';

export const evolutionRouter = Router();

async function handleMessage(req: Request, res: Response) {
  if (config.evolution.webhookSecret) {
    if (req.headers['x-webhook-secret'] !== config.evolution.webhookSecret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  const payload = req.body as EvolutionWebhookPayload;

  if (payload.event?.toLowerCase() !== 'messages.upsert' || payload.data?.key?.fromMe) {
    res.sendStatus(200);
    return;
  }

  const from = payload.data.key.remoteJid;
  const text =
    payload.data.message?.conversation ??
    payload.data.message?.extendedTextMessage?.text;

  if (!text) { res.sendStatus(200); return; }

  console.log(`[WhatsApp] ${from.replace(/[\r\n]/g, '')}`);
  res.sendStatus(200);

  if (text.trim() === '/clear') {
    await clearThread(from);
    await sendText(from, '🗑️ Conversa reiniciada.');
    return;
  }

  const reply = await invokeAgent(from, text);
  await sendText(from, reply);
}

evolutionRouter.post('/', handleMessage);
evolutionRouter.post('/messages-upsert', handleMessage);
