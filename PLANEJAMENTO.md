# Planejamento — Bot de Agendamento Clínica ComVida

## Contexto

Bot conversacional via WhatsApp que conduz o paciente pelo agendamento médico de forma humanizada, sem parecer um formulário, com estado persistido por número de telefone.

Stack: LangGraph + PostgresSaver + OpenRouter + Evolution API + MCP (ClinicWeb API)

---

## Fase 1 — Base de Conhecimento Local

**Objetivo:** Eliminar chamadas lentas à API para dados estáticos e habilitar verificação de cobertura de convênio.

### Etapa 1.1 — Popular arquivos base

**O que fazer:**
- Executar `scripts/fetch-convenios.js` — gera `base/convenios.json` com `codConvenio`, `nome`, `planos[]`, `observacao`
- Executar `scripts/fetch-profissionais.js` — gera `base/profissionais.json` com `idProfissional`, `nome`, `especialidades[]`
- Executar `scripts/fetch-procedimentos.js` — gera `base/procedimentos.json`

**Validação:**
```bash
# Verificar que os arquivos foram gerados e têm conteúdo
cat base/convenios.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} convênios')"
cat base/profissionais.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} profissionais')"
```
✅ Passa se: arquivos existem, têm > 0 registros, e campos obrigatórios estão presentes

---

### Etapa 1.2 — Loader em memória

**O que fazer:**
- Criar `src/base/loader.ts` que lê os JSONs na inicialização e expõe funções de acesso tipadas
- **Nunca passar `convenios.json` inteiro ao LLM** — o arquivo tem centenas de convênios e causa overflow de tokens. Sempre usar lookup pontual (`buscarConvenio(nome)`) que retorna apenas o objeto do convênio solicitado. `profissionais.json` é pequeno o suficiente para ir no system prompt.

**Validação:**
```typescript
// Teste unitário
import { getConvenios, getProfissionais } from './loader';
assert(getConvenios().length > 0);
assert(getProfissionais().every(p => p.idProfissional && p.especialidades));
```
✅ Passa se: dados carregam sem erro e tipos estão corretos

---

### Etapa 1.3 — Fuzzy match de convênio

**O que fazer:**
- Instalar `fuse.js`
- Criar `src/base/convenio-matcher.ts` com função `matchConvenio(nome: string)` que retorna o convênio mais próximo

**Validação:**
```typescript
// Casos de teste
assert(matchConvenio('bradesco saude')?.nome.includes('Bradesco'));
assert(matchConvenio('unimed')?.nome.toLowerCase().includes('unimed'));
assert(matchConvenio('xyz inexistente') === null); // threshold mínimo
```
✅ Passa se: variações de nome encontram o convênio correto, nomes inválidos retornam null

---

### Etapa 1.4 — Verificador de cobertura

**O que fazer:**
- Criar `src/base/cobertura-checker.ts` com função `checkCobertura(codConvenio, especialidade)` que analisa o campo `observacao`

**Validação:**
```typescript
// Casos de teste com dados reais do convenios.json
const resultado = checkCobertura(222, 'Cardiologia');
assert(resultado.coberto === true || resultado.coberto === false);
assert(typeof resultado.observacao === 'string');
```
✅ Passa se: retorna `{ coberto: boolean, observacao: string }` para qualquer entrada

---

## Fase 2 — Estado Tipado e Grafo LangGraph

**Objetivo:** Substituir o `createReactAgent` genérico por um grafo LangGraph com estado explícito e nós determinísticos.

### Estado tipado

```typescript
interface BookingState {
  messages: BaseMessage[];
  step: 'identificacao' | 'convenio' | 'especialidade' | 'horarios' | 'confirmacao' | 'concluido';
  paciente?: { idPaciente: number; nome: string; dataNascimento: string };
  convenio?: { codConvenio: number; codPlano: number; nome: string };
  especialidade?: { nome: string; idProfissional: number };
  horario?: { data: string; hora: string; intervalo: number; codProcedimento: number };
  agendamentoId?: number;        // idempotência — evita criar duas vezes
  tentativas: Record<string, number>;
  lastActivityAt: string;        // ISO timestamp — controla retomada vs reinício
}
```

### Lógica de retomada de sessão

| Tempo inativo | Comportamento |
|---|---|
| < 30 min | Continua normalmente, sem mensagem extra |
| 30 min – 24h | Retoma com contexto: _"Você estava agendando [especialidade]. Quer continuar?"_ |
| > 24h | Reinicia o fluxo com saudação nova |

### Nós do grafo

```
[entrada] → [retomada?] → [identificacao] → [convenio] → [especialidade] → [horarios] → [confirmacao] → [concluido]
                ↓ (fora de escopo)
          [guardrail_redirect]
```

---

### Etapa 2.1 — Estado e reducer

**O que fazer:**
- Criar `src/agent/state.ts` com `BookingState`, `Annotation.Root` e reducer de mensagens

**Validação:**
```typescript
// Estado inicial deve ter valores padrão corretos
const initial = getInitialState();
assert(initial.step === 'identificacao');
assert(initial.tentativas !== undefined);
assert(initial.messages.length === 0);
```
✅ Passa se: estado inicial é válido e reducer acumula mensagens corretamente

---

### Etapa 2.2 — Nó de identificação

**O que fazer:**
- Criar nó `identificacao` que coleta nome e CPF, chama `buscar_pacientes`, confirma com o paciente
- Tratar: paciente não encontrado → oferecer cadastro (coletar data de nascimento e sexo, chamar `criar_paciente`)
- Tratar: CPF inválido (máx 2 tentativas sem encontrar → escalar)

**Sub-estados do nó:**
- `pacientePendente` — aguardando confirmação de identidade (paciente encontrado)
- `cadastroPendente` — coletando dados para criar novo paciente (nome+CPF já coletados, falta dataNascimento e sexo)

**Fluxo de cadastro:**
```
CPF não encontrado
  → bot pergunta se quer se cadastrar
  → sim → coleta dataNascimento (YYYY-MM-DD) e sexo (M/F)
  → callMcp('criar_paciente') → step: 'convenio'
  → não / 2ª tentativa → step: 'escalado'
```

**Validação (via WhatsApp):**
1. Mandar "Oi" → bot pede nome
2. Informar nome → bot pede CPF
3. Informar CPF válido (`42023779820`) → bot confirma "LUCAS NATALIO SANTOS"
4. Confirmar → step avança para `convenio`
5. Informar CPF inexistente → bot oferece cadastro
6. Aceitar cadastro → bot coleta data de nascimento e sexo → cria paciente → avança
7. Recusar cadastro → bot escala para atendente

✅ Passa se: estado tem `paciente.idPaciente` preenchido após confirmação ou criação

---

### Etapa 2.3 — Nó de convênio

**O que fazer:**
- Criar nó `convenio` que pergunta o convênio, usa `matchConvenio()`, lista planos, confirma
- Tratar: particular, convênio não encontrado, paciente não sabe o plano

**Validação (via WhatsApp):**
1. Dizer "Bradesco" → bot confirma "Bradesco Saúde" e lista planos
2. Dizer "não tenho convênio" → bot define particular e avança
3. Dizer convênio inexistente → bot informa que não trabalha com ele

✅ Passa se: estado tem `convenio.codConvenio` e `convenio.codPlano` preenchidos

---

### Etapa 2.4 — Nó de especialidade

**O que fazer:**
- Criar nó `especialidade` que identifica a especialidade em `base/profissionais.json`, verifica cobertura via `checkCobertura()`
- Tratar: especialidade não coberta (oferecer particular), especialidade não reconhecida

**Validação (via WhatsApp):**
1. Dizer "Cardiologia" → bot confirma disponibilidade e avança
2. Dizer especialidade não coberta pelo convênio → bot informa e oferece particular
3. Dizer algo não reconhecido → bot pede para reformular

✅ Passa se: estado tem `especialidade.idProfissional` preenchido

---

### Etapa 2.5 — Nó de horários

**O que fazer:**
- Criar nó `horarios` que chama `proximos_horarios_livres`, apresenta até 3 opções de forma natural
- Tratar: sem horários em 7 dias (expandir para 15), paciente pede horário específico

**Validação (via WhatsApp):**
1. Bot apresenta até 3 opções no formato "Quinta 11/03 às 11h50"
2. Escolher opção → estado tem `horario` preenchido com `intervalo` correto
3. Pedir "só de manhã" → bot filtra e reapresenta

✅ Passa se: estado tem `horario.data`, `horario.hora`, `horario.intervalo` preenchidos

---

### Etapa 2.6 — Nó de confirmação e criação

**O que fazer:**
- Criar nó `confirmacao` que apresenta resumo completo, aguarda confirmação, chama `criar_agendamento`
- Salvar `agendamentoId` no estado imediatamente após criação
- Tratar: erro de API (horário ocupado → reapresentar opções), paciente quer alterar algo

**Validação (via WhatsApp):**
1. Bot apresenta resumo com especialidade, data, hora e convênio
2. Confirmar → agendamento criado, bot confirma com data e hora
3. Pedir alteração → volta para etapa correspondente
4. Simular erro de API → bot informa e oferece outros horários

✅ Passa se: agendamento aparece no sistema ClinicWeb após confirmação

---

### Etapa 2.7 — Lógica de retomada de sessão

**O que fazer:**
- Adicionar nó `entrada` que verifica `lastActivityAt` e decide entre continuar, retomar ou reiniciar

**Validação:**
1. Iniciar conversa, chegar até convênio, esperar 1h (simular alterando `lastActivityAt` no Postgres), mandar mensagem → bot retoma com contexto
2. Simular > 24h → bot reinicia com saudação nova mas estado anterior foi limpo

✅ Passa se: bot retoma corretamente sem pedir dados já coletados

---

## Fase 3 — Humanização e Guardrails

**Objetivo:** Bot com tom natural, resistente a desvios de assunto, sem alucinações.

---

### Etapa 3.1 — Guardrail de input

**O que fazer:**
- Criar `src/agent/guardrails.ts` com `checkInput(message, step)` — classificação leve via LLM (prompt binário: "é sobre agendamento médico?")
- Adicionar ao nó `entrada` antes de qualquer lógica de negócio

**Validação:**
1. Mandar "qual o resultado do jogo de ontem?" → bot redireciona para agendamento
2. Tentar prompt injection ("ignore as instruções anteriores") → bot redireciona
3. Mandar "quero agendar" → passa normalmente

✅ Passa se: mensagens fora de escopo recebem redirecionamento gentil, mensagens válidas passam sem interferência

---

### Etapa 3.2 — Guardrail de output

**O que fazer:**
- Criar `checkOutput(reply)` que bloqueia respostas com IDs técnicos ou dados internos

**Validação:**
```typescript
assert(checkOutput('Encontrei o profissional id 26782081') === false);
assert(checkOutput('Encontrei disponibilidade para Cardiologia') === true);
```
✅ Passa se: respostas com dados técnicos são bloqueadas antes de enviar

---

### Etapa 3.3 — Humanização dos prompts

**O que fazer:**
- Refinar prompt de cada nó com persona definida (nome, tom, estilo)
- Adicionar few-shot examples de respostas naturais vs robóticas
- Implementar mensagem de espera ("Um momento...") quando tool demora > 3s

**Validação (qualitativa via WhatsApp):**
1. Conduzir conversa completa e avaliar se parece natural
2. Verificar que bot não usa listas numeradas desnecessárias
3. Verificar que mensagem de espera aparece antes de `proximos_horarios_livres`

✅ Passa se: conversa parece natural para um usuário leigo

---

### Etapa 3.4 — Controle de tentativas

**O que fazer:**
- Implementar verificação de `tentativas[campo]` em cada nó
- Após 2 tentativas sem sucesso: oferecer alternativa (ex: "Posso te ajudar de outra forma?")

**Validação:**
1. Informar CPF inválido 3x → na 3ª tentativa bot oferece alternativa
2. Dizer convênio inexistente 2x → bot oferece particular

✅ Passa se: bot nunca fica em loop infinito pedindo o mesmo dado

---

## Fase 4 — Robustez e Observabilidade

**Objetivo:** Bot pronto para uso real com tratamento de erros, proteções e monitoramento.

---

### Etapa 4.1 — Mutex por threadId

**O que fazer:**
- Criar `src/utils/mutex.ts` com mapa de locks por `threadId`
- Aplicar no webhook antes de invocar o agente

**Validação:**
1. Enviar duas mensagens simultâneas (via curl em paralelo) para o mesmo número
2. Verificar nos logs que a segunda aguardou a primeira terminar

✅ Passa se: estado não fica corrompido com mensagens simultâneas

---

### Etapa 4.2 — Deduplicação de mensagens

**O que fazer:**
- Manter Set em memória com `messageId`s processados nos últimos 5 minutos
- Ignorar silenciosamente mensagens com `messageId` já visto

**Validação:**
1. Reenviar o mesmo payload de webhook duas vezes
2. Verificar que apenas uma resposta foi enviada

✅ Passa se: segundo envio não gera resposta duplicada

---

### Etapa 4.3 — Timeout global e tratamento de erro por nó

**O que fazer:**
- Envolver `invokeAgent` em `Promise.race` com timeout de 30s
- Cada nó captura seus erros específicos e retorna mensagem amigável

**Validação:**
1. Simular timeout desligando o MCP durante uma chamada → bot responde com mensagem de erro amigável
2. Simular erro 500 da API de agendamento → bot informa e oferece outros horários

✅ Passa se: nenhum erro chega ao usuário como stack trace ou mensagem técnica

---

### Etapa 4.4 — Rate limiting

**O que fazer:**
- Criar `src/utils/rate-limiter.ts` com contador por `threadId` (janela de 1 minuto)
- Bloquear com mensagem amigável se > 20 mensagens/minuto

**Validação:**
1. Enviar 25 mensagens em sequência rápida
2. A partir da 21ª, bot responde com aviso de limite

✅ Passa se: limite é respeitado sem afetar uso normal

---

### Etapa 4.5 — Truncamento de histórico

**O que fazer:**
- No `invokeAgent`, antes de chamar o grafo, truncar `messages` para as últimas 10
- Estado estruturado (`paciente`, `convenio`, etc.) é sempre preservado integralmente

**Validação:**
1. Conduzir conversa longa (> 20 trocas)
2. Verificar que tokens enviados ao LLM não crescem indefinidamente nos logs

✅ Passa se: conversa longa não aumenta latência nem custo por mensagem

---

### Etapa 4.6 — Atualização automática do base/

**O que fazer:**
- Criar job com `node-cron` que roda diariamente às 3h e re-executa os scripts `fetch-*.js`
- Recarregar o loader em memória após atualização

**Validação:**
1. Disparar o job manualmente
2. Verificar que arquivos `base/` foram atualizados e loader recarregou

✅ Passa se: dados ficam frescos sem reiniciar o servidor

---

### Etapa 4.7 — Logs estruturados

**O que fazer:**
- Substituir `console.log` por logger estruturado com campos: `threadId`, `step`, `tool`, `latencia`, `ts`
- Cada entrada de log é um JSON em `logs/<threadId>.jsonl`

**Validação:**
1. Conduzir conversa completa
2. Verificar que log contém todos os campos e latências por tool

✅ Passa se: é possível reconstruir toda a conversa e identificar gargalos de performance pelo log

---

---

## Fase 5 — Follow-up e Engajamento

**Objetivo:** Aumentar comparecimento e reengajar pacientes que não concluíram o agendamento.

---

### Etapa 5.1 — Lembrete de consulta

**O que fazer:**
- Job `node-cron` que roda a cada hora e busca agendamentos criados pelo bot com data nas próximas 24h
- Para cada agendamento, verifica via API ClinicWeb se ainda está ativo (`buscar_agendamento`)
- Se ativo, envia lembrete via Evolution API: _"Olá! Lembrando que você tem consulta amanhã às [hora]. Confirma presença?"_
- Registrar no estado que lembrete foi enviado para não reenviar

**Validação:**
1. Criar agendamento para o dia seguinte
2. Disparar o job manualmente
3. Verificar que mensagem chegou no WhatsApp
4. Disparar novamente — verificar que não envia duplicado

✅ Passa se: lembrete chega exatamente uma vez, somente para agendamentos ativos

---

### Etapa 5.2 — Recuperação de abandono

**O que fazer:**
- Job que roda a cada 30 minutos e busca sessões com `step !== 'concluido'` e `lastActivityAt` entre 2h e 24h atrás
- Envia mensagem de recuperação: _"Oi! Vi que você estava agendando uma consulta de [especialidade]. Posso te ajudar a finalizar?"_
- Se `step === 'identificacao'` (não coletou nada ainda): não envia — evita spam para quem apenas abriu o chat
- Registrar no estado que recuperação foi enviada para não reenviar

**Validação:**
1. Iniciar conversa, chegar até etapa de convênio, parar de responder
2. Simular `lastActivityAt` = 3h atrás no Postgres
3. Disparar job manualmente
4. Verificar que mensagem de recuperação chegou com contexto correto
5. Responder — verificar que bot retoma de onde parou

✅ Passa se: mensagem de recuperação tem contexto correto e bot retoma o fluxo ao responder

---

### Etapa 5.3 — Pós-consulta

**O que fazer:**
- Job que roda diariamente e busca agendamentos com data = ontem criados pelo bot
- Verifica se consulta ocorreu (status diferente de cancelado)
- Envia mensagem: _"Esperamos que sua consulta tenha corrido bem! Precisa de algum retorno ou novo agendamento?"_
- Se paciente responder "sim" ou similar, inicia novo fluxo de agendamento

**Validação:**
1. Criar agendamento com data = hoje
2. Avançar data simulada para amanhã e disparar job
3. Verificar que mensagem pós-consulta chegou
4. Responder "quero agendar retorno" — verificar que bot inicia novo fluxo

✅ Passa se: mensagem pós-consulta chega no dia seguinte e bot responde corretamente ao engajamento

---

## Ordem de execução

```
Fase 1 (1.1 → 1.2 → 1.3 → 1.4)
  ↓
Fase 2 (2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7)
  ↓
Fase 3 (3.1 → 3.2 → 3.3 → 3.4)
  ↓
Fase 4 (4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6 → 4.7)
  ↓
Fase 5 (5.1 → 5.2 → 5.3)
```

Cada etapa tem critério de validação explícito. Não avançar para a próxima etapa sem a validação da atual passar.

---

## O que NÃO está no escopo (por ora)

- Human-in-the-loop (transferência para atendente)
- Cancelamento/reagendamento de consultas existentes
- Notificações de lembrete
- Painel de administração
