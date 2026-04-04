# Development Guidelines — poc-clinic-web

## Code Quality Standards

### Language & Locale
- All user-facing bot messages are in **Brazilian Portuguese** (pt-BR)
- Code comments, variable names, and documentation mix Portuguese and English — prefer English for code identifiers, Portuguese for domain terms (e.g., `convenio`, `paciente`, `especialidade`, `horario`)
- System prompts and LLM instructions are written in Portuguese

### TypeScript Conventions (Backend)
- Use `interface` for data shapes, `type` for unions/aliases
- Prefer `const` over `let`; avoid `var`
- Use `as const` for config objects (see `config/index.ts`)
- Use Zod schemas for LLM structured output validation
- Use `Annotation.Root` from LangGraph for state definitions with explicit reducers
- Export functions directly (no default exports in backend code)
- Use `async`/`await` consistently — no raw `.then()` chains

### React/Frontend Conventions
- Use `"use client"` directive for interactive components
- Material UI `sx` prop for inline styling (admin UIs)
- Tailwind CSS for chat-ui
- Functional components with `React.FC` typing
- `next/image` for optimized images

### Error Handling Pattern
Every node and critical function follows this pattern:
```typescript
try {
  // business logic
} catch (e) {
  logError('context', 'functionName', e);
  return {
    messages: [new AIMessage('Friendly error message in Portuguese')],
    lastActivityAt: new Date().toISOString(),
  };
}
```
- Always return a user-friendly message — never expose stack traces
- Use `logError(context, operation, error)` for structured logging
- Escalate to human (`step: 'escalado'`) on unrecoverable errors

## Architectural Patterns

### LangGraph Node Pattern (v1 — node-per-step)
Each conversation step is a separate node function with this signature:
```typescript
export async function nodeNameNode(state: BookingState): Promise<Partial<BookingState>> {
  // 1. Extract last user message
  const lastUser = [...state.messages].reverse().find(m => m._getType() === 'human');
  const userText = typeof lastUser?.content === 'string' ? lastUser.content.trim() : '';

  // 2. Handle sub-states (e.g., pacientePendente, cadastroPendente)
  if (state.someSubState) { /* handle sub-flow */ }

  // 3. Classify user intent via LLM structured output
  const intent = await classify(state, 'context description');

  // 4. Execute business logic based on intent
  // 5. Return partial state update with messages + step transition
  return {
    messages: [new AIMessage('response')],
    step: 'nextStep',
    lastActivityAt: new Date().toISOString(),
  };
}
```

### LLM Reply Helper Pattern
Every node has a local `reply()` function that wraps LLM calls with the node's system prompt:
```typescript
async function reply(state: BookingState, instruction: string): Promise<string> {
  const llm = makeLlm();
  const response = await llm.invoke([
    new SystemMessage(REPLY_PROMPT),
    ...state.messages,
    new HumanMessage(`[INSTRUÇÃO INTERNA] ${instruction}`),
  ]);
  return typeof response.content === 'string'
    ? response.content
    : (response.content as { type: string; text?: string }[]).find(c => c.type === 'text')?.text ?? '';
}
```
- System prompt is node-specific (not global)
- Internal instructions are passed as `[INSTRUÇÃO INTERNA]` prefixed HumanMessage
- Always handle both string and array content formats from LLM responses

### LLM Classification Pattern
Use `withStructuredOutput(zodSchema)` for intent classification:
```typescript
const IntentSchema = z.object({
  intent: z.enum(['option_a', 'option_b', 'outro']),
  valor: z.string().nullable().optional(),
});

async function classify(state: BookingState, context: string): Promise<Intent> {
  const llm = makeLlm().withStructuredOutput(IntentSchema);
  const lastUser = [...state.messages].reverse().find(m => m._getType() === 'human');
  const userText = typeof lastUser?.content === 'string' ? lastUser.content : '';
  return llm.invoke([
    new SystemMessage(`Classification instructions with examples...`),
    new HumanMessage(userText),
  ]);
}
```

### MCP Tool Call Pattern
All ClinicWeb API calls go through the MCP server:
```typescript
async function callMcp(name: string, args: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${config.mcp.url}/tool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': config.mcp.apiKey },
    body: JSON.stringify({ tool: name, args }),
  });
  if (!res.ok) throw new Error(`MCP error ${res.status}`);
  const data = await res.json() as unknown;
  return typeof data === 'string' ? data : JSON.stringify(data);
}
```

### ClinicWeb API Wrapper Pattern (clinicweb.js)
- Auth token cached with 5-minute pre-expiry renewal
- Automatic retry on 5xx errors (up to 3 attempts with linear backoff)
- Input validation via `assertDate()` / `assertHora()` helpers
- All methods return `json.data ?? json` (handles ClinicWeb's inconsistent response wrapping)
- Configurable timeout per endpoint (e.g., `/pacientes` gets 25s due to frequent 504s)

### State Management
- Every state update MUST include `lastActivityAt: new Date().toISOString()`
- Use `tentativas` record to track retry counts per field (max 2 before escalation)
- Sub-states (e.g., `pacientePendente`, `cadastroPendente`, `aguardandoCadastro`) control within-node flow
- Clear sub-states when transitioning: `pacientePendente: undefined`
- Step transitions are explicit: `step: 'nextStep'`

### Concurrency Control
- **Debounce**: Aggregate rapid messages per threadId (4-10s window) before processing
- **Mutex**: Promise-based queue per threadId prevents concurrent graph invocations
- **Deduplication**: Track processed messageIds to prevent duplicate responses

### Fuzzy Matching Pattern
Use Fuse.js for user input matching against known data:
```typescript
const fuse = new Fuse(items, { keys: ['fieldName'], threshold: 0.4, ignoreLocation: true });
const result = fuse.search(query)[0]?.item ?? null;
```
- Clean user input (remove stopwords, special chars) before matching
- Use `threshold: 0.4` for reasonable fuzzy tolerance
- Always handle null results (item not found)

## Testing Patterns

### Integration Test Structure (test-flow.js)
Tests follow a step-by-step conversation flow:
```javascript
async function stepN_description() {
  console.log('\n── STEP N: Description ──');
  const reply = await chat('user message');
  ok('Assertion label', /expected_pattern/i.test(reply));
  return reply;
}
```
- Each step is an async function that sends a message and validates the response
- Use `ok(label, condition, detail)` helper for ✅/❌ output
- Steps run sequentially, passing context between them
- Pre-condition step cleans up test data
- Post-condition step cancels created appointments

### Data Extraction Patterns
- **CPF**: Regex `\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11}` — handles formatted and unformatted
- **Date**: Multiple formats supported: `DD/MM/YYYY`, `YYYY-MM-DD`, `DDMMYYYY`
- **Time**: Regex `\d{1,2}[h:]\d{2}` — handles both `14:30` and `14h30`
- Always strip non-digits for CPF: `.replace(/\D/g, '')`

## Domain Rules (Bot Behavior)
- **Never disclose pricing** — transfer to human immediately
- **Never show technical IDs** (idPaciente, codConvenio, etc.) to patients
- **Max 2 retries** per field before escalating to human
- **Natural tone** — avoid numbered lists, form-like interactions
- **Particular fallback**: `codConvenio=-1, codPlano=-2`
- **Session resumption**: <30min silent, 30min-24h context reminder, >24h restart
- **Business hours check**: Bot checks `botConfig.horarioAtendimento` before processing
