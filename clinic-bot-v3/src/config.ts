import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3005),
  postgres: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/clinic_bot',
  },
  mcp: {
    url: process.env.MCP_URL ?? 'http://localhost:3000',
    apiKey: process.env.MCP_API_KEY ?? '',
  },
  zapi: {
    instanceId: process.env.ZAPI_INSTANCE_ID ?? '',
    token: process.env.ZAPI_TOKEN ?? '',
    clientToken: process.env.ZAPI_CLIENT_TOKEN ?? '',
  },
  debounceMs: Number(process.env.DEBOUNCE_MS ?? 2000),
  horario: {
    // Formato: { seg: { inicio: '08:00', fim: '18:00' }, ... }
    // null = dia desabilitado
    seg: { inicio: '08:00', fim: '18:00' },
    ter: { inicio: '08:00', fim: '18:00' },
    qua: { inicio: '08:00', fim: '18:00' },
    qui: { inicio: '08:00', fim: '18:00' },
    sex: { inicio: '08:00', fim: '18:00' },
    sab: null as { inicio: string; fim: string } | null,
    dom: null as { inicio: string; fim: string } | null,
  },
} as const;
