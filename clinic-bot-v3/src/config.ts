import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3005),
  postgres: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/clinic_bot',
  },
  clinicweb: {
    url: process.env.CW_API_URL ?? 'https://clinicweb-api.prod.clinicweb.linx.com.br',
    username: process.env.CW_USERNAME ?? '',
    password: process.env.CW_PASSWORD ?? '',
    codEmpresa: Number(process.env.COD_EMPRESA ?? 155),
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
