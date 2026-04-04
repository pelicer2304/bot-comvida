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
} as const;
