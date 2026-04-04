# Arquitetura do Backend — Bot de Agendamento Clínica Comvida

## Problema Central

O bot atual perde contexto porque o LLM é stateless. A cada mensagem, ele recebe o histórico inteiro e **infere** em que passo está. Isso falha quando o histórico fica longo ou tem tool results pesados no meio.

A solução é um backend com **estado explícito no código**, onde o LLM executa apenas o passo atual — não o fluxo inteiro.

---

## 1. Máquina de Estados com LangGraph

### Por que LangGraph?

LangGraph modela o fluxo como um grafo de nós. O estado é um objeto tipado que persiste entre os nós. O LLM só vê o contexto do nó atual.

### Grafo do Fluxo de Agendamento

```
[START]
  ↓
[coletar_identificacao]     → pede nome + CPF + data nascimento
  ↓
[buscar_ou_criar_paciente]  → busca no ClinicWeb, cria se não existir
  ↓
[verificar_menor_idade]     → se < 18 anos → [coletar_responsavel]
  ↓
[coletar_especialidade]     → pergunta especialidade/procedimento
  ↓
[coletar_convenio]          → pergunta plano, verifica regras via RAG
  ↓
[buscar_horarios]           → listar_especialidades_disponiveis + proximos_horarios_livres
  ↓
[confirmar_agendamento]     → resume dados, pede confirmação
  ↓
[criar_agendamento]         → chama MCP server
  ↓
[END]

Em qualquer nó:
  → [transferir_humano]     → se paciente insistir em preço ou situação complexa
```

### Estado Tipado

```typescript
interface AgendamentoState {
  step: string;
  paciente: {
    nome?: string;
    cpf?: string;
    dataNascimento?: string;
    idPaciente?: number;
    ehMenor?: boolean;
    responsavel?: { nome: string; cpf: string; telefone: string };
  };
  consulta: {
    especialidade?: string;
    idProfissional?: number;
    codProcedimento?: number;
    data?: string;
    hora?: string;
  };
  convenio: {
    tipo: 'particular' | 'plano' | null;
    codConvenio?: number;
    codPlano?: number;
    validado?: boolean;
  };
  mensagens: Message[];
  transferirHumano?: boolean;
}
```

### Stack

- `@langchain/langgraph` — grafo de estados
- `@langchain/openai` ou OpenRouter — LLM
- `express` ou `fastify` — API HTTP
- MCP server existente — tools de ClinicWeb

---

## 2. Contexto — Como o Bot Não Perde o Fio

### Problema

O LLM recebe o histórico inteiro a cada mensagem. Com tool results grandes (lista de convênios, horários, etc.), o contexto fica poluído e o modelo se perde.

### Solução: Contexto Mínimo por Nó

Cada nó do LangGraph passa pro LLM **apenas o que ele precisa**:

```typescript
// Nó: coletar_convenio
const prompt = `
Você está coletando o convênio do paciente ${state.paciente.nome}.
Especialidade solicitada: ${state.consulta.especialidade}

Pergunta ao paciente se possui plano de saúde ou se é particular.
Se perguntar sobre preço, transfira para humano.
`;
// O LLM não vê o histórico de busca de horários, nem a lista de profissionais.
```

### Checkpointing

LangGraph tem suporte nativo a checkpoints — o estado é salvo após cada nó. Se a conversa cair, retoma do ponto exato onde parou.

```typescript
import { MemorySaver } from '@langchain/langgraph';
// ou PostgresSaver para produção
const checkpointer = new MemorySaver();
```

---

## 3. RAG para Regras de Convênio

### O que é RAG aqui?

Cada convênio tem regras: carências, procedimentos cobertos, necessidade de guia, limite de consultas por ano, etc. Em vez de colocar tudo no prompt (impossível — são centenas de convênios), você usa RAG para buscar só as regras relevantes no momento.

### RAG sem Banco de Dados — É Possível?

**Sim.** Para volumes pequenos/médios (até ~500 documentos), você pode usar embeddings em memória com `faiss-node` ou `vectra`:

```typescript
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { OpenAIEmbeddings } from '@langchain/openai';

// Na inicialização do servidor
const vectorStore = await FaissStore.fromDocuments(
  regrasConvenios, // array de documentos com texto das regras
  new OpenAIEmbeddings()
);

// Salva em disco (arquivo .faiss) — sem banco de dados
await vectorStore.save('./data/convenios.faiss');

// Na consulta
const regras = await vectorStore.similaritySearch(
  `${convenio} cobre ${especialidade}?`, 3
);
```

O índice FAISS é um arquivo local. Sem Redis, sem Postgres, sem Pinecone. Para produção com muitos convênios, aí sim vale um banco vetorial (pgvector no Postgres, por exemplo).

### Estrutura dos Documentos

```typescript
const regrasConvenios = [
  {
    pageContent: `Unimed: consulta de Reumatologia requer guia de autorização prévia. 
                  Carência de 180 dias para procedimentos eletivos.`,
    metadata: { codConvenio: 7792, tipo: 'regra_autorizacao' }
  },
  {
    pageContent: `Particular: sem carência, sem guia. Pagamento no ato.`,
    metadata: { codConvenio: -1, tipo: 'regra_geral' }
  }
  // ...
];
```

### Uso no Nó de Validação de Convênio

```typescript
// Nó: verificar_convenio
const regras = await vectorStore.similaritySearch(
  `${state.convenio.codConvenio} cobre ${state.consulta.especialidade}`, 2
);

const prompt = `
Regras do convênio do paciente:
${regras.map(r => r.pageContent).join('\n')}

O convênio ${state.convenio.tipo} cobre ${state.consulta.especialidade}?
Responda apenas: COBRE, NAO_COBRE, ou REQUER_AUTORIZACAO.
`;
```

---

## 4. Few-Shot para Agendamento

### O que é Few-Shot aqui?

São exemplos de conversas bem-sucedidas injetados no prompt do nó para guiar o LLM a responder no formato correto.

### Onde Usar

- **Nó de coleta de dados**: ensinar o formato esperado de CPF, data
- **Nó de confirmação**: ensinar como resumir o agendamento
- **Nó de transferência**: ensinar quando e como transferir para humano

### Exemplo Prático

```typescript
const fewShotExemplos = `
Exemplo 1:
Paciente: "meu cpf é 420.237.798-20"
Assistente: [extrai "42023779820" e busca no sistema]

Exemplo 2:
Paciente: "quanto custa a consulta?"
Assistente: "Não tenho acesso aos valores das consultas. Vou transferir você para nossa equipe que poderá te ajudar com isso."

Exemplo 3:
Paciente: "quero marcar pra semana que vem"
Assistente: [busca horários disponíveis e apresenta as opções sem mencionar o nome do médico]
`;
```

### Few-Shot Dinâmico (avançado)

Armazenar exemplos de conversas reais bem-sucedidas e buscar os mais similares via RAG para injetar no prompt. Isso melhora com o tempo conforme o bot é usado.

---

## 5. Guardrails

### O que são Guardrails?

Validações que impedem o bot de fazer coisas que não deve — antes de enviar pro LLM e antes de executar uma ação.

### Guardrails de Input (antes do LLM)

```typescript
function guardrailInput(mensagem: string): 'ok' | 'transferir' | 'bloquear' {
  const gatilhosPreco = ['quanto custa', 'qual o valor', 'preço', 'valor da consulta'];
  const gatilhosBloqueio = ['senha', 'cartão de crédito', 'dados bancários'];

  if (gatilhosBloqueio.some(g => mensagem.toLowerCase().includes(g)))
    return 'bloquear';

  if (gatilhosPreco.some(g => mensagem.toLowerCase().includes(g)))
    return 'transferir';

  return 'ok';
}
```

### Guardrails de Output (antes de enviar pro paciente)

```typescript
function guardrailOutput(resposta: string): string {
  // Nunca deixar o bot mencionar valores
  if (/R\$\s*\d+/.test(resposta))
    return 'Não tenho acesso aos valores. Nossa equipe pode te ajudar com isso.';

  // Nunca deixar o bot mencionar nome do médico
  // (validar contra lista de profissionais)

  return resposta;
}
```

### Guardrails de Ação (antes de criar agendamento)

```typescript
// Antes de chamar criar_agendamento
function guardrailAgendamento(state: AgendamentoState): string | null {
  if (!state.paciente.idPaciente) return 'Paciente não identificado';
  if (!state.consulta.data || !state.consulta.hora) return 'Horário não selecionado';
  if (!state.convenio.validado) return 'Convênio não validado';
  return null; // ok
}
```

---

## 6. Arquitetura do Backend

```
frontend (Next.js chat)
    ↓ POST /chat { sessionId, message }
    
backend (Express + LangGraph)
    ├── SessionManager     → carrega/salva estado da conversa (Redis ou arquivo)
    ├── GuardrailsInput    → valida mensagem antes do LLM
    ├── LangGraph          → executa o nó atual do fluxo
    │   ├── LLM (OpenRouter)
    │   ├── RAG (FAISS local)
    │   └── Tools → MCP Server (ClinicWeb API)
    └── GuardrailsOutput   → valida resposta antes de enviar
    
    ↓ { reply, sessionId, step }
```

### Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/chat` | Envia mensagem, recebe resposta |
| GET | `/chat/:sessionId` | Retorna histórico da sessão |
| GET | `/sessions` | Lista sessões (para análise) |
| POST | `/chat/:sessionId/transferir` | Força transferência para humano |

---

## 7. Roadmap de Implementação

### Fase 1 — Backend estruturado (substitui o route.ts atual)
- [ ] LangGraph com os nós do fluxo
- [ ] Estado tipado e checkpointing em memória
- [ ] Guardrails básicos (preço → transferir humano)

### Fase 2 — RAG de convênios
- [ ] Coletar regras dos convênios (manual ou scraping)
- [ ] Indexar com FAISS local
- [ ] Integrar no nó `verificar_convenio`

### Fase 3 — Few-shot e qualidade
- [ ] Banco de exemplos de conversas bem-sucedidas
- [ ] Few-shot dinâmico via similaridade
- [ ] Guardrails de output (nome do médico, valores)

### Fase 4 — Produção
- [ ] Checkpointing em Redis ou Postgres
- [ ] FAISS → pgvector se volume crescer
- [ ] Observabilidade (LangSmith ou similar)
- [ ] Deploy Railway / Fly.io

---

## Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Grafo de estados | `@langchain/langgraph` |
| LLM | OpenRouter (Claude Sonnet) |
| Embeddings | `text-embedding-3-small` (OpenAI) |
| Vetor store | FAISS local → pgvector em produção |
| Tools / API | MCP Server existente |
| Sessões | MemorySaver → Redis em produção |
| Backend | Express + TypeScript |
| Frontend | Next.js (chat-ui existente) |
