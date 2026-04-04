import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4003),
  evolution: {
    url: process.env.EVOLUTION_API_URL ?? '',
    apiKey: process.env.EVOLUTION_API_KEY ?? '',
    instance: process.env.EVOLUTION_INSTANCE ?? '',
    webhookSecret: process.env.WEBHOOK_SECRET ?? '',
  },
  postgres: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5434/clinic_bot_v2',
  },
  openai: {
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
    baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    model: process.env.LLM_MODEL ?? 'anthropic/claude-sonnet-4-5',
    modelExtractor: process.env.LLM_MODEL_EXTRACTOR ?? 'anthropic/claude-haiku-4-5',
  },
  clinicweb: {
    url: process.env.CW_API_URL ?? '',
    username: process.env.CW_USERNAME ?? '',
    password: process.env.CW_PASSWORD ?? '',
    codEmpresa: Number(process.env.COD_EMPRESA ?? 155),
  },
  admin: {
    username: process.env.ADMIN_USERNAME ?? 'admin',
    password: process.env.ADMIN_PASSWORD ?? '',
    jwtSecret: process.env.ADMIN_JWT_SECRET ?? 'change-me',
  },
} as const;
