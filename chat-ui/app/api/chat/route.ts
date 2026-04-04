// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { TOOLS } from '@/lib/tools';
import { loadSession, createSession, saveSession, appendLog, type Message } from '@/lib/sessions';

const SYSTEM_PROMPT = `Você é a assistente virtual da Clínica Comvida, responsável por realizar agendamentos médicos.

Siga SEMPRE este fluxo na ordem exata:
1. Cumprimente e pergunte o nome completo do paciente
2. Pergunte o CPF e busque o cadastro (buscar_pacientes)
   - Se não encontrar: pergunte data de nascimento e sexo, depois crie o cadastro (criar_paciente)
   - Se encontrar: confirme o nome e a data de nascimento que retornou
3. Verifique se é menor de idade (menos de 18 anos pela data de nascimento)
   - Se menor: peça nome completo, CPF e telefone do responsável antes de continuar
4. Pergunte qual especialidade ou tipo de consulta deseja (ex: cardiologia, ortopedia, dermatologia)
5. Pergunte se possui plano de saúde/convênio
   - Se sim: verifique os convênios do paciente (convenios_paciente) e liste as opções encontradas
   - Se não tiver convênio cadastrado ou disser que não tem: use particular (codConvenio=-1, codPlano=-2)
6. Busque todos os profissionais com listar_profissionais (use term='a') — NÃO mostre os nomes dos médicos ao paciente
   - O endpoint busca por nome do profissional, não por especialidade. Sempre use term='a' para trazer todos
   - Para cada profissional retornado, verifique as especialidades (especialidades_profissional) e filtre os que atendem a especialidade pedida
   - Para os profissionais filtrados, verifique horários (proximos_horarios_livres) silenciosamente
   - Se nenhum profissional da especialidade pedida tiver horários, chame listar_especialidades_disponiveis e apresente as opções ao paciente
7. Apresente apenas as datas e horários disponíveis ao paciente (ex: "Segunda, 14/07 às 09:00") — sem mencionar o nome do médico
8. Após o paciente escolher o horário, confirme: data, hora, especialidade e convênio
9. Crie o agendamento (criar_agendamento) e confirme com o número do agendamento

Regras:
- Colete um dado por vez, nunca faça múltiplas perguntas na mesma mensagem
- Nunca mostre nomes de médicos ao paciente — apenas datas e horários
- Nunca invente horários — use apenas os retornados pelas tools
- Sempre busque o paciente pelo CPF
- Se o paciente quiser cancelar um agendamento existente, use cancelar_agendamento
- Responda sempre em português brasileiro, de forma cordial e objetiva
- Hoje é ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

async function callMcp(toolName: string, args: Record<string, unknown>): Promise<string> {
  const mcpUrl = process.env.MCP_URL || 'http://localhost:3000';
  const apiKey = process.env.MCP_API_KEY || '';

  // Chama o MCP server via REST direto (sem SSE) usando a rota de tool call HTTP
  // Como o MCP usa SSE, chamamos o clinicweb.js diretamente via endpoint auxiliar
  const res = await fetch(`${mcpUrl}/tool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ tool: toolName, args }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCP error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return typeof data === 'string' ? data : JSON.stringify(data);
}

export async function POST(req: NextRequest) {
  const { sessionId: incomingSessionId, message } = await req.json();

  const sessionId = incomingSessionId || uuidv4();
  const session = loadSession(sessionId) || createSession(sessionId);

  // Adiciona mensagem do usuário
  session.messages.push({ role: 'user', content: message });
  appendLog(sessionId, { event: 'user_message', content: message });

  // Monta histórico para o LLM (filtra campos extras que o OpenAI não aceita)
  const history: Message[] = session.messages.map((m) => {
    const base: Message = { role: m.role, content: m.content };
    if (m.tool_call_id) base.tool_call_id = m.tool_call_id;
    if (m.tool_calls) base.tool_calls = m.tool_calls;
    if (m.name) base.name = m.name;
    return base;
  });

  // Loop de tool calls
  let iterations = 0;
  const MAX_ITER = 10;

  while (iterations < MAX_ITER) {
    iterations++;

    const llmRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3001',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-5',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
        tools: TOOLS,
        tool_choice: 'auto',
      }),
    });

    if (!llmRes.ok) {
      const err = await llmRes.text();
      return NextResponse.json({ error: `LLM error: ${err}` }, { status: 500 });
    }

    const llmData = await llmRes.json();
    const choice = llmData.choices[0];
    const assistantMsg = choice.message;

    // Adiciona resposta do assistente ao histórico
    history.push(assistantMsg);

    if (choice.finish_reason === 'tool_calls' && assistantMsg.tool_calls?.length) {
      // Executa todas as tool calls em paralelo
      const toolResults = await Promise.all(
        assistantMsg.tool_calls.map(async (tc: { id: string; function: { name: string; arguments: string } }) => {
          const args = (() => { try { return JSON.parse(tc.function.arguments || '{}'); } catch { return {}; } })();
          appendLog(sessionId, { event: 'tool_call', tool: tc.function.name, args });

          let result: string;
          try {
            result = await callMcp(tc.function.name, args);
          } catch (e) {
            result = `Erro: ${(e as Error).message}`;
          }

          appendLog(sessionId, { event: 'tool_result', tool: tc.function.name, result: result.slice(0, 500) });

          return {
            role: 'tool' as const,
            tool_call_id: tc.id,
            name: tc.function.name,
            content: result,
          };
        })
      );

      history.push(...toolResults);
      continue;
    }

    // Resposta final do assistente
    const finalContent = assistantMsg.content || '';
    appendLog(sessionId, { event: 'assistant_message', content: finalContent });

    // Persiste sessão com histórico completo
    session.messages = history;
    saveSession(session);

    return NextResponse.json({ sessionId, reply: finalContent });
  }

  return NextResponse.json({ sessionId, reply: 'Desculpe, ocorreu um erro interno. Tente novamente.' });
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  const session = loadSession(sessionId);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  return NextResponse.json(session);
}
