// src/config/index.ts
import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3002),
  evolution: {
    url: process.env.EVOLUTION_API_URL ?? '',
    apiKey: process.env.EVOLUTION_API_KEY ?? '',
    instance: process.env.EVOLUTION_INSTANCE ?? '',
    webhookSecret: process.env.WEBHOOK_SECRET ?? '',
  },
  postgres: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/clinic_bot',
  },
  openai: {
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
    baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    model: process.env.LLM_MODEL ?? 'anthropic/claude-sonnet-4-5',
  },
  mcp: {
    url: process.env.MCP_URL ?? 'http://localhost:3000',
    apiKey: process.env.MCP_API_KEY ?? '',
  },
} as const;
