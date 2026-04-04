import 'dotenv/config';
import express from 'express';
import { config } from './config';
import { evolutionRouter } from './webhooks/evolution-webhook';
import { adminRouter } from './admin/router';

const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'clinic-bot-api' }));

app.use('/webhook/evolution', evolutionRouter);
app.use('/admin', adminRouter);

app.listen(config.port, () => {
  console.log(`clinic-bot-api rodando em http://localhost:${config.port}`);
  console.log(`Webhook Evolution: POST http://localhost:${config.port}/webhook/evolution`);
});
