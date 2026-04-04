# Plano de Sprints — Bot V3 (Menu-Driven + Z-API)

## Visão Geral

Bot de agendamento **sem IA humanizada** — mensagens fixas, menus com botões/listas do WhatsApp. Sem LLM gerando respostas, sem LangGraph, sem OpenRouter. Máquina de estados pura em TypeScript.

**Estratégia: Playground primeiro, Z-API por último.** O bot inteiro é desenvolvido e testado via playground local. Z-API é só o transporte final — plugar no fim é criar 2 arquivos.

### O que muda em relação ao V1/V2

| Aspecto | V1/V2 (atual) | V3 (novo) |
|---|---|---|
| Tom | Humanizado, LLM gera cada resposta | Direto, mensagens fixas pré-definidas |
| Gateway WhatsApp | Evolution API | **Z-API** (z-api.io) — plugado por último |
| Motor de decisão | LangGraph + LLM classification | Máquina de estados simples (switch/case) |
| Custo por mensagem | ~$0.01-0.03 (tokens LLM) | **$0** (sem LLM) |
| Latência | 3-8s (LLM + MCP) | **<1s** (só MCP) |
| Dependências LLM | LangGraph, OpenRouter, Anthropic | **Nenhuma** |
| Frontend teste | chat-ui (porta 3001) | **bot-playground** (porta 3004) — novo |

### O que se mantém

- **clinicweb-mcp** — MCP server (porta 3000) continua igual, todas as tools já prontas
- **base/** — JSONs de convênios, profissionais, procedimentos
- **Fuse.js** — fuzzy match de convênio
- **Fluxo de 6 etapas** do FLUXO_BOT.md (identificação → convênio → especialidade → horários → confirmação → escalação)
- **PostgreSQL** — agora pra persistir sessões do bot (não mais checkpoints LangGraph)

---

## Sprint 1 — Fundação + Playground

**Objetivo:** Backend rodando, playground funcional, estado persistido, saudação funcionando. Tudo testável localmente sem Z-API.

### 1.1 — Scaffold do projeto `clinic-bot-v3/`

```
clinic-bot-v3/
├── base/                    # Symlink ou cópia dos JSONs
├── src/
│   ├── server.ts            # Express (porta 3005) — /chat REST + /webhook/zapi
│   ├── config.ts            # Env vars (MCP, Postgres, Z-API opcional)
│   ├── logger.ts            # Logs estruturados
│   ├── state/
│   │   ├── types.ts         # Interface SessionState + BotResponse
│   │   └── store.ts         # CRUD de sessão (Postgres)
│   ├── bot/
│   │   ├── engine.ts        # Máquina de estados (processMessage)
│   │   ├── messages.ts      # Todas as mensagens fixas do bot
│   │   └── steps/
│   │       ├── saudacao.ts
│   │       ├── identificacao.ts
│   │       ├── convenio.ts
│   │       ├── especialidade.ts
│   │       ├── horarios.ts
│   │       └── confirmacao.ts
│   ├── mcp/
│   │   └── client.ts        # callMcp() — reutiliza padrão existente
│   └── base/
│       ├── loader.ts        # Reutiliza do v1
│       ├── convenio-matcher.ts
│       └── cobertura-checker.ts
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

**Dependências:**
```json
{
  "express": "^4.19.2",
  "fuse.js": "^7.1.0",
  "pg": "^8.19.0",
  "dotenv": "^16.4.5"
}
```
Zero dependência de LangChain/LangGraph/OpenRouter.

### 1.2 — Endpoint REST para playground

```typescript
// clinic-bot-v3 expõe endpoint REST — playground e testes usam isso
app.post('/chat', async (req, res) => {
  const { phone, message, buttonId } = req.body;
  const responses = await processMessage(phone, message ?? buttonId);
  res.json({ responses });
});
```

### 1.3 — Estado e persistência

```typescript
interface SessionState {
  phone: string;
  step: 'saudacao' | 'identificacao' | 'convenio' | 'especialidade' | 'horarios' | 'confirmacao' | 'concluido' | 'escalado';
  paciente?: { idPaciente: number; nome: string; cpf: string; dataNascimento: string };
  convenio?: { codConvenio: number; codPlano: number; nome: string };
  especialidade?: { nome: string; idProfissional: number; idsProfissionais: number[] };
  horario?: { data: string; hora: string; intervalo: number; codProcedimento: number };
  agendamentoId?: number;
  tentativas: Record<string, number>;
  subStep?: string;
  tempData?: Record<string, unknown>;
  lastActivityAt: string;
  createdAt: string;
}
```

Tabela Postgres:
```sql
CREATE TABLE bot_sessions (
  phone       TEXT PRIMARY KEY,
  state       JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.4 — Engine (máquina de estados)

```typescript
async function processMessage(phone: string, text: string): Promise<BotResponse[]> {
  let session = await loadSession(phone) ?? createSession(phone);
  session = checkSessionTimeout(session);

  const handler = stepHandlers[session.step];
  const result = await handler(session, text);

  await saveSession({ ...session, ...result.stateUpdate });
  return result.responses;
}
```

### 1.5 — Playground (`bot-playground/`)

```
bot-playground/
├── app/
│   ├── page.tsx             # Chat com simulação de botões/listas
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── chat/route.ts    # POST → clinic-bot-v3 /chat
│       └── sessions/route.ts
├── components/
│   ├── ChatMessage.tsx      # Renderiza texto, botões, listas
│   ├── ButtonGroup.tsx      # Simula botões do WhatsApp
│   └── OptionList.tsx       # Simula option-list do WhatsApp
├── lib/
│   └── types.ts             # BotResponse types
├── package.json             # Next.js 14, React 18, Tailwind
└── tsconfig.json
```

**Porta:** 3004

**Tipos de resposta que o playground renderiza:**
```typescript
type BotResponse =
  | { type: 'text'; text: string }
  | { type: 'buttons'; text: string; buttons: { id: string; label: string }[] }
  | { type: 'list'; text: string; buttonLabel: string; sections: { title: string; rows: { id: string; title: string; description?: string }[] }[] };
```

**Validação Sprint 1:**
- [ ] `clinic-bot-v3`: `npm run dev` sobe na porta 3005
- [ ] `bot-playground`: `npm run dev` sobe na porta 3004
- [ ] Enviar mensagem no playground → bot responde saudação
- [ ] Sessão persiste no Postgres
- [ ] Timeout de sessão funciona (>24h reinicia)
- [ ] Botões renderizam como chips clicáveis no playground
- [ ] Listas renderizam como dropdown/modal no playground

---

## Sprint 2 — Etapa 1: Identificação do Paciente

**Objetivo:** Paciente identificado por CPF, cadastro novo se necessário.

### Fluxo (mensagens fixas)

```
Bot: "Olá! 👋 Sou a assistente virtual da Clínica ComVida.
      Para agendar sua consulta, preciso do seu CPF."

Paciente: "420.237.798-20"

Bot: "Encontrei o cadastro de *LUCAS NATALIO SANTOS*. É você?"
     [Botão: ✅ Sim]  [Botão: ❌ Não]

Paciente: [clica Sim]

Bot: "Perfeito, Lucas! Você possui convênio médico?"
     → avança para Sprint 3
```

### Caminhos alternativos

```
CPF não encontrado:
  Bot: "Não encontrei cadastro com esse CPF. Deseja se cadastrar?"
       [Botão: ✅ Cadastrar]  [Botão: 👤 Falar com atendente]

  [Cadastrar]:
    Bot: "Qual seu nome completo?"
    Bot: "Qual sua data de nascimento? (DD/MM/AAAA)"
    Bot: "Qual seu sexo?"
         [Botão: Masculino]  [Botão: Feminino]
    → callMcp('criar_paciente', {...})
    Bot: "Cadastro realizado! ✅ Vamos agendar sua consulta."

CPF inválido (2x):
  Bot: "Não consegui identificar o CPF. Vou transferir para um atendente."
  → step: 'escalado'
```

### Sub-steps da identificação

```
subStep: null                  → pede CPF
subStep: 'aguardando_cpf'     → valida CPF, busca paciente
subStep: 'confirmar_paciente' → aguarda botão Sim/Não
subStep: 'cadastro_nome'      → coleta nome
subStep: 'cadastro_nascimento'→ coleta data nascimento
subStep: 'cadastro_sexo'      → coleta sexo (botões)
```

**Validação Sprint 2:**
- [ ] CPF válido encontra paciente e pede confirmação via botão
- [ ] CPF não encontrado oferece cadastro via botão
- [ ] Cadastro completo cria paciente no ClinicWeb
- [ ] 2 tentativas de CPF inválido → escala para humano
- [ ] Regex CPF aceita `420.237.798-20` e `42023779820`
- [ ] Tudo testável no playground

---

## Sprint 3 — Etapa 2: Convênio e Plano

**Objetivo:** Convênio identificado via fuzzy match + seleção por lista.

### Fluxo

```
Bot: "Você possui convênio médico?"
     [Botão: 💳 Sim, tenho convênio]  [Botão: 💰 Particular]

[Particular]:
  → codConvenio=-1, codPlano=-2
  → avança para Sprint 4

[Sim, tenho convênio]:
  Bot: "Digite o nome do seu convênio."

  Paciente: "bradesco"

  → matchConvenio('bradesco') via Fuse.js

  Se 1 plano:
    Bot: "Convênio *Bradesco Saúde* confirmado! ✅"
    → avança para Sprint 4

  Se ≤10 planos:
    Bot: "Convênio *Bradesco Saúde* identificado. Qual seu plano?"
         [Lista: 1. Plano A | 2. Plano B | 3. Plano C ...]

  Se >10 planos:
    Bot: "Convênio *Bradesco Saúde* identificado. Digite o nome do plano como aparece na carteirinha."
    → fuzzy match com Fuse.js nos planos

  Convênio não encontrado:
    Bot: "Não trabalhamos com esse convênio. Deseja agendar como particular?"
         [Botão: 💰 Sim, particular]  [Botão: 👤 Falar com atendente]
```

**Validação Sprint 3:**
- [ ] "Particular" define codConvenio=-1 e avança
- [ ] Fuzzy match encontra "bradesco" → "Bradesco Saúde"
- [ ] Lista de planos aparece como option-list no playground
- [ ] Convênio inexistente oferece particular via botão

---

## Sprint 4 — Etapa 3: Especialidade + Cobertura

**Objetivo:** Especialidade selecionada, cobertura verificada.

### Fluxo

```
Bot: "Qual especialidade você precisa?"
     [Lista de especialidades disponíveis via option-list]
     (extraídas de base/profissionais.json — apenas as que têm profissional)

Paciente: [seleciona "Cardiologia"]

→ checkCobertura(codConvenio, 'Cardiologia')

Se coberto:
  Bot: "Cardiologia confirmada! ✅ Vou buscar os horários disponíveis..."
  → avança para Sprint 5

Se não coberto:
  Bot: "Seu convênio não cobre Cardiologia. Deseja agendar como particular?"
       [Botão: 💰 Sim, particular]  [Botão: 🔄 Outra especialidade]  [Botão: 👤 Atendente]
```

**Validação Sprint 4:**
- [ ] Lista de especialidades aparece como option-list
- [ ] Cobertura verificada no campo observacao
- [ ] Especialidade não coberta oferece particular via botão
- [ ] Profissionais sem agenda não aparecem na lista

---

## Sprint 5 — Etapa 4: Horários Disponíveis

**Objetivo:** Paciente escolhe horário de uma lista real da API.

### Fluxo

```
→ buscarTodosHorarios(idsProfissionais, 7 dias)
→ se vazio, expande para 15 dias

Bot: "Horários disponíveis para Cardiologia:"
     [Lista via option-list:]
     1. Segunda, 14/07 às 09:00
     2. Segunda, 14/07 às 10:30
     3. Terça, 15/07 às 14:00
     (máximo 10 opções)

     [Botão extra: 📅 Ver mais horários]  [Botão: 👤 Atendente]

Paciente: [seleciona opção 1]

Bot: "Horário selecionado: *Segunda, 14/07 às 09:00* ✅"
→ avança para Sprint 6
```

### Sem horários

```
Bot: "Não encontrei horários disponíveis para Cardiologia nos próximos 15 dias."
     [Botão: 🔄 Outra especialidade]  [Botão: 👤 Falar com atendente]
```

**Validação Sprint 5:**
- [ ] Horários reais da API aparecem como option-list
- [ ] Máximo 10 opções por lista
- [ ] "Ver mais" carrega próxima página
- [ ] Sem horários → oferece alternativas via botão
- [ ] Formato: "Segunda, 14/07 às 09:00"

---

## Sprint 6 — Etapa 5: Confirmação + Criação

**Objetivo:** Resumo apresentado, agendamento criado no ClinicWeb.

### Fluxo

```
Bot: "📋 *Resumo do agendamento:*

      👤 Paciente: Lucas Santos
      🏥 Especialidade: Cardiologia
      📅 Data: Segunda, 14/07/2025 às 09:00
      💳 Convênio: Particular

      Confirma o agendamento?"
      [Botão: ✅ Confirmar]  [Botão: ✏️ Alterar]  [Botão: ❌ Cancelar]

[Confirmar]:
  → callMcp('criar_agendamento', {...})
  Bot: "✅ Agendamento confirmado!

        📅 Segunda, 14/07/2025 às 09:00
        🏥 Cardiologia

        Até lá! Se precisar de algo, é só chamar. 😊"
  → step: 'concluido'

[Alterar]:
  Bot: "O que deseja alterar?"
       [Botão: 📅 Horário]  [Botão: 🏥 Especialidade]  [Botão: 💳 Convênio]
  → volta para o step correspondente

[Cancelar]:
  Bot: "Agendamento cancelado. Se precisar, é só chamar!"
  → step: 'concluido'
```

### Erro na criação

```
Horário ocupado:
  Bot: "Esse horário acabou de ser ocupado. Vou buscar outros."
  → volta para step 'horarios'

Erro de API:
  Bot: "Tive um problema ao criar o agendamento. Vou transferir para um atendente."
  → step: 'escalado'
```

**Validação Sprint 6:**
- [ ] Resumo mostra todos os dados corretos
- [ ] Botão Confirmar cria agendamento no ClinicWeb
- [ ] Agendamento aparece na API com codStatus=2
- [ ] Botão Alterar volta para step correto
- [ ] Horário ocupado redireciona para busca de horários
- [ ] Idempotência: confirmar 2x não cria duplicado

---

## Sprint 7 — Polimento e Testes

### 7.1 — Debounce + Mutex
- Debounce de 2s por phone (WhatsApp manda mensagens rápidas)
- Mutex por phone (evita processamento concorrente)

### 7.2 — Timeout de sessão
- <30min: continua silenciosamente
- 30min-24h: "Você estava agendando [especialidade]. Quer continuar?" [Sim] [Recomeçar]
- >24h: reinicia sessão

### 7.3 — Horário de atendimento
- Verificar config de horário antes de processar
- Fora do horário: "Nosso atendimento é de segunda a sexta, das 8h às 18h. Retorne nesse horário!"

### 7.4 — Comando /clear
- Paciente digita `/clear` → reinicia sessão

### 7.5 — Logs e métricas
- Log estruturado por phone (JSONL)
- Métricas: agendamentos criados, abandonos por etapa, tempo médio

### 7.6 — Testes de integração
- Adaptar `test-flow.js` para o V3 (POST /chat)
- Testar fluxo completo: saudação → CPF → convênio → especialidade → horário → confirmação
- Testar caminhos alternativos: CPF inválido, convênio inexistente, sem horários

**Validação Sprint 7:**
- [ ] Mensagens rápidas não corrompem estado
- [ ] Sessão retoma após 1h de inatividade
- [ ] Fora do horário retorna mensagem fixa
- [ ] `/clear` reinicia conversa
- [ ] test-flow.js passa todos os steps

---

## Sprint 8 — Integração Z-API

**Objetivo:** Plugar o bot (já pronto e testado) no WhatsApp via Z-API.

### 8.1 — Client Z-API (`zapi/client.ts`)

```
POST https://api.z-api.io/instances/{instanceId}/token/{token}/send-text
POST https://api.z-api.io/instances/{instanceId}/token/{token}/send-button-list
POST https://api.z-api.io/instances/{instanceId}/token/{token}/send-option-list
```
Headers: `Client-Token: {clientToken}`

Mapeia `BotResponse[]` → chamadas Z-API:
- `{ type: 'text' }` → `send-text`
- `{ type: 'buttons' }` → `send-button-list`
- `{ type: 'list' }` → `send-option-list`

### 8.2 — Webhook Z-API (`zapi/webhook.ts`)

- Endpoint: `POST /webhook/zapi`
- Payload Z-API: `{ phone, text: { message }, isGroup, messageId, ... }`
- Filtrar: ignorar `isGroup=true`, ignorar mensagens do próprio bot
- Recebe mensagem → `processMessage(phone, text)` → envia respostas via client

### 8.3 — Env vars

```
ZAPI_INSTANCE_ID=
ZAPI_TOKEN=
ZAPI_CLIENT_TOKEN=
ZAPI_WEBHOOK_SECRET=
```

**Validação Sprint 8:**
- [ ] Webhook recebe mensagem do WhatsApp e loga
- [ ] Bot responde saudação no WhatsApp real
- [ ] Botões aparecem como botões nativos do WhatsApp
- [ ] Listas aparecem como option-list nativa
- [ ] Fluxo completo funciona no WhatsApp (saudação → agendamento confirmado)
- [ ] Debounce funciona com mensagens rápidas reais

---

## Resumo de Portas

| Serviço | Porta |
|---------|-------|
| clinicweb-mcp | 3000 |
| chat-ui (v1/v2) | 3001 |
| clinic-bot-api (v1) | 3002 |
| admin-ui | 3003 |
| **bot-playground (v3)** | **3004** |
| **clinic-bot-v3** | **3005** |
| PostgreSQL | 5433 |

## Ordem de Execução

```
Sprint 1 — Fundação + Playground (backend + frontend de teste)
  ↓
Sprint 2 — Identificação do paciente (CPF + cadastro)
  ↓
Sprint 3 — Convênio e plano (fuzzy match + listas)
  ↓
Sprint 4 — Especialidade + cobertura
  ↓
Sprint 5 — Horários disponíveis (API real)
  ↓
Sprint 6 — Confirmação + criação do agendamento
  ↓
Sprint 7 — Polimento e testes (debounce, mutex, timeout, test-flow)
  ↓
Sprint 8 — Integração Z-API (plugar no WhatsApp)
```

Cada sprint tem critérios de validação. Não avançar sem a validação da sprint anterior passar.
