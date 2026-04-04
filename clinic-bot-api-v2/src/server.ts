import 'dotenv/config';
import express from 'express';
import { config } from './config';
import { evolutionRouter } from './webhooks/evolution-webhook';
import { invokeAgent, clearThread, initGraph } from './agent/graph';

const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'clinic-bot-api-v2' }));

app.post('/chat', async (req, res) => {
  const { threadId, message } = req.body as { threadId?: string; message?: string };
  if (!threadId || !message) { res.status(400).json({ error: 'threadId e message obrigatórios' }); return; }
  try {
    const reply = await invokeAgent(threadId, message);
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.delete('/chat/:threadId', async (req, res) => {
  await clearThread(req.params.threadId).catch(() => {});
  res.json({ ok: true });
});

app.use('/webhook/evolution', evolutionRouter);

app.listen(config.port, async () => {
  await initGraph();
  console.log(`clinic-bot-api-v2 rodando em http://localhost:${config.port}`);
  console.log(`Webhook Evolution: POST http://localhost:${config.port}/webhook/evolution`);
});
