import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { signToken, adminAuth } from './auth';
import { listSessions, getSession, deleteSession, getSessionMessages } from './sessions';
import { getBotConfig, saveBotConfig } from './botConfig';
import { getConvenios, patchConvenio } from './convenios';
import { computeMetrics } from './metrics';
import { config } from '../config';
import { clearThread } from '../agent/graph';

export const adminRouter = Router();

// ── Auth ──────────────────────────────────────────────────────────────────────
adminRouter.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Credenciais inválidas' });
    return;
  }
  res.json({ token: signToken(username) });
});

// Todas as rotas abaixo exigem token
adminRouter.use(adminAuth);

// ── Sessions ──────────────────────────────────────────────────────────────────
adminRouter.get('/sessions', async (_req, res) => {
  res.json(await listSessions());
});

adminRouter.get('/sessions/escaladas', async (_req, res) => {
  const all = await listSessions();
  res.json(all.filter((s) => s.step === 'escalado'));
});

// SSE — stream de escalamentos em tempo real
adminRouter.get('/sessions/escaladas/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  async function send() {
    const all = await listSessions();
    const escaladas = all.filter((s) => s.step === 'escalado');
    res.write(`data: ${JSON.stringify(escaladas)}\n\n`);
  }

  await send();
  const id = setInterval(send, 15_000);
  req.on('close', () => clearInterval(id));
});

adminRouter.get('/sessions/:threadId', async (req, res) => {
  const s = await getSession(req.params.threadId);
  if (!s) { res.status(404).json({ error: 'Sessão não encontrada' }); return; }
  res.json(s);
});

adminRouter.get('/sessions/:threadId/messages', (req, res) => {
  res.json(getSessionMessages(req.params.threadId));
});

// Export CSV de mensagens da sessão
adminRouter.get('/sessions/:threadId/export', (req, res) => {
  const msgs = getSessionMessages(req.params.threadId);
  const rows = msgs.map((m: { ts: string; role: string; message: string }) =>
    `"${m.ts}","${m.role}","${String(m.message).replace(/"/g, '""')}"`
  );
  const csv = ['ts,role,message', ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="sessao-${req.params.threadId}.csv"`);
  res.send(csv);
});

// Assumir atendimento — pausa o bot marcando step como 'escalado' e limpa o thread
adminRouter.post('/sessions/:threadId/assumir', async (req, res) => {
  await clearThread(req.params.threadId).catch(() => {});
  res.json({ ok: true });
});

adminRouter.delete('/sessions/:threadId', async (req, res) => {
  await deleteSession(req.params.threadId);
  res.json({ ok: true });
});

// ── Metrics ───────────────────────────────────────────────────────────────────
adminRouter.get('/metrics', (req, res) => {
  const periodo = (req.query.periodo as string) ?? 'hoje';
  res.json(computeMetrics(periodo as 'hoje' | 'semana' | 'mes'));
});

// ── Config ────────────────────────────────────────────────────────────────────
adminRouter.get('/config', (_req, res) => res.json(getBotConfig()));
adminRouter.patch('/config', (req, res) => res.json(saveBotConfig(req.body)));

// ── Agendamentos (proxy ClinicWeb) ────────────────────────────────────────────
let _cwToken: string | null = null;
let _cwTokenExp = 0;

async function cwFetch(path: string, method = 'GET', body?: object, attempt = 1): Promise<unknown> {
  const CW_URL = process.env.CW_API_URL ?? 'https://clinicweb-api.prod.clinicweb.linx.com.br';

  if (!_cwToken || Date.now() > _cwTokenExp - 60_000) {
    const authRes = await fetch(`${CW_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: process.env.CW_USERNAME, password: process.env.CW_PASSWORD }),
    });
    const text = await authRes.text();
    let json: { token?: string };
    try { json = JSON.parse(text); } catch { throw new Error(`ClinicWeb auth falhou: ${text.slice(0, 100)}`); }
    if (!json.token) throw new Error(`ClinicWeb auth sem token: ${text.slice(0, 100)}`);
    _cwToken = json.token;
    _cwTokenExp = Date.now() + 55 * 60 * 1000;
  }

  const res = await fetch(`${CW_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `JWT ${_cwToken}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();

  if (res.status >= 500 && attempt <= 3) {
    await new Promise(r => setTimeout(r, attempt * 1500));
    return cwFetch(path, method, body, attempt + 1);
  }

  let data: { data?: unknown };
  try { data = JSON.parse(text); } catch { throw new Error(`ClinicWeb resposta inválida (${res.status}): ${text.slice(0, 100)}`); }
  return (data as { data?: unknown })?.data ?? data;
}

const COD_EMPRESA = Number(process.env.COD_EMPRESA ?? 155);

adminRouter.get('/agendamentos', async (req, res) => {
  const { data, idProfissional } = req.query;
  const path = `/agendamentos?codEmpresa=${COD_EMPRESA}&startDate=${data}&endDate=${data}${idProfissional ? `&codProfissionais[]=${idProfissional}` : ''}`;
  try {
    const result = await cwFetch(path);
    const items = Array.isArray(result) ? result : [];
    res.json(items.map((a: any) => ({
      codAgendamento: a.codAgendamento,
      data: a.data?.split('T')[0] ?? a.data,
      hora: a.hora?.slice(0, 5) ?? a.hora,
      pacienteNome: a.Paciente?.nome ?? '',
      convenioNome: a.Convenio?.descricaoConvenio ?? '',
      profissionalNome: a.Profissional?.nome ?? '',
      especialidade: a.Especialidade?.descricao ?? a.especialidade?.descri ?? '',
      procedimento: a.GrupoProcedimento?.nome ?? '',
      status: a.status ?? 0,
      statusDescricao: a.Status?.descricao ?? '',
      criadoPeloBot: false,
    })));
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

adminRouter.patch('/agendamentos/:cod/status', async (req, res) => {
  const { idStatus } = req.body;
  try {
    res.json(await cwFetch(`/agendamentos/${req.params.cod}`, 'PATCH', { idEmpresa: COD_EMPRESA, agendamento: { idStatus } }));
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

// ── Convênios ─────────────────────────────────────────────────────────────────
adminRouter.get('/convenios', (_req, res) => res.json(getConvenios()));
adminRouter.get('/convenios/:cod', (req, res) => {
  const list = getConvenios();
  const item = list.find((c: { codConvenio: number }) => c.codConvenio === Number(req.params.cod));
  if (!item) { res.status(404).json({ error: 'Não encontrado' }); return; }
  res.json(item);
});
adminRouter.patch('/convenios/:cod', (req, res) => {
  res.json(patchConvenio(Number(req.params.cod), req.body.observacao));
});
adminRouter.post('/convenios/sync', async (_req, res) => {
  const { execFile } = await import('child_process');
  execFile('node', ['scripts/fetch-convenios.js'], { cwd: process.cwd() }, (err) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ ok: true });
  });
});

// ── Pacientes (proxy ClinicWeb) ───────────────────────────────────────────────
adminRouter.get('/pacientes', async (req, res) => {
  const { query } = req.query;
  if (!query) { res.status(400).json({ error: 'query obrigatório' }); return; }
  try {
    res.json(await cwFetch(`/pacientes?codEmpresa=${COD_EMPRESA}&query=${encodeURIComponent(query as string)}`));
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

adminRouter.get('/pacientes/:id', async (req, res) => {
  try {
    const [paciente, convenios] = await Promise.all([
      cwFetch(`/pacientes?codEmpresa=${COD_EMPRESA}&query=${req.params.id}`),
      cwFetch(`/empresas/${COD_EMPRESA}/paciente/${req.params.id}/convenios`),
    ]);
    res.json({ paciente, convenios });
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

// ── Profissionais ─────────────────────────────────────────────────────────────
adminRouter.get('/profissionais', (_req, res) => {
  const data = JSON.parse(readFileSync(join(process.cwd(), 'base', 'profissionais.json'), 'utf-8'));
  res.json(data);
});
