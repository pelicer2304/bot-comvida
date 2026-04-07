import 'dotenv/config';
import express from 'express';
import { config } from './config';
import { setupDb } from './state/store';
import { listSessions } from './state/store';
import { processMessage } from './bot/engine';
import { zapiRouter } from './zapi/webhook';

const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'clinic-bot-v3' }));

// Endpoint REST — usado pelo playground e testes
app.post('/chat', async (req, res) => {
  const { phone, message, buttonId } = req.body as { phone?: string; message?: string; buttonId?: string };
  if (!phone) { res.status(400).json({ error: 'phone obrigatório' }); return; }
  const input = buttonId ?? message ?? '';
  if (!input) { res.status(400).json({ error: 'message ou buttonId obrigatório' }); return; }

  try {
    const responses = await processMessage(phone, input);
    res.json({ responses });
  } catch (e) {
    console.error('[chat] erro:', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

// Lista sessões — usado pelo playground
app.get('/sessions', async (_req, res) => {
  try {
    const sessions = await listSessions();
    res.json(sessions);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Webhook Z-API
app.use('/webhook/zapi', zapiRouter);

async function start() {
  await setupDb();
  app.listen(config.port, () => {
    console.log(`clinic-bot-v3 rodando em http://localhost:${config.port}`);
  });
}

start();
