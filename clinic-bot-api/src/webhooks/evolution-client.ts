// src/webhooks/evolution-client.ts
import { config } from '../config';

export async function sendText(to: string, text: string): Promise<void> {
  const res = await fetch(
    `${config.evolution.url}/message/sendText/${config.evolution.instance}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.evolution.apiKey,
      },
      body: JSON.stringify({ number: to, text }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution API error ${res.status}: ${body}`);
  }
}
