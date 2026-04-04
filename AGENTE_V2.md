# Agente de Agendamento V2 — Clínica ComVida

## Visão Geral

Substituição do grafo LangGraph com nós fixos por um **ReAct Agent único** com system prompt dinâmico, capaz de lidar com qualquer contexto conversacional mantendo o objetivo de realizar o agendamento.

---

## Princípios da V2

- **Um agente, não um formulário** — o LLM decide o que fazer a cada turno com base no estado atual e no histórico
- **Estado como contexto, não como roteador** — o estado estruturado informa o LLM do que já foi coletado, mas não força um caminho fixo
- **Sem classificações intermediárias** — elimina as chamadas LLM separadas para classifyConfirmation, classifyPeriodo, etc.
- **Conversação natural** — o paciente pode fornecer múltiplos dados numa mensagem, mudar de assunto e voltar, sem o bot travar

---

## Arquitetura

```
entrada (timeout/horário de atendimento)
    ↓
agente_unico (ReAct loop: LLM → tools → LLM)
    ↓
extração de estado (LLM leve pós-turno)
    ↓
[concluido | escalado]
```

### Comparação com V1

| Aspecto | V1 (atual) | V2 |
|---|---|---|
| Nós do grafo | 7 nós fixos | 1 nó de agente |
| Prompts | ~12 espalhados por nó | 2 (principal + extração) |
| Chamadas LLM por turno | 3-5 (classificações + resposta) | 1-2 (resposta + extração) |
| Lida com desvios de assunto | ❌ | ✅ |
| Coleta múltiplos dados por mensagem | ❌ | ✅ |
| Custo por turno | Maior | Menor |

---

## Prompts

### 1. System Prompt Principal (dinâmico)

Único prompt que o LLM vê a cada turno. Composto por seções estáticas + seções dinâmicas injetadas em runtime.

**Seções estáticas** (definidas uma vez):
- Persona e objetivo da Ana
- Dados da clínica (endereço, telefone, horários)
- Lista de especialidades e médicos (de `profissionais.json`)
- Nomes dos convênios aceitos (de `convenios.json`)
- Regras de negócio
- Few-shots

**Seções dinâmicas** (geradas por `buildSystemPrompt(state)`):
- Estado atual da conversa (o que já foi coletado)
- Próximo passo (instrução baseada no que falta)

### 2. Prompt de Extração de Estado (pós-turno)

Chamada leve com modelo barato (haiku/mini) após cada resposta do agente.
Extrai dados estruturados do histórico recente e faz merge no estado.
Substitui todas as classificações intermediárias da V1.

---

## Estado

Mantém o mesmo `BookingState` da V1 — o estado estruturado continua existindo para:
- Garantir que dados já coletados não sejam reperguntados
- Persistência via PostgresSaver (LangGraph checkpoint)
- Lógica de timeout/retomada de sessão (30min / 24h)
- Idempotência no `criar_agendamento`

---

## Estratégia de Dados

### O que vai no system prompt (estático)
- Lista de especialidades disponíveis — o LLM precisa para mapear sintomas para especialidades
- Nomes dos médicos por especialidade — pequeno (~20 médicos), não muda
- Nomes dos convênios aceitos — o LLM precisa reconhecer quando o paciente cita um convênio

### O que vira ferramenta MCP (dinâmico)
| Dado | Ferramenta | Motivo |
|---|---|---|
| Cadastro do paciente | `buscar_pacientes(cpf)` | Dado real do sistema |
| Criar paciente novo | `criar_paciente(dados)` | Escrita no sistema |
| Planos de um convênio | `listar_convenios(codConvenio)` | Pode ter dezenas de planos |
| Horários disponíveis | `proximos_horarios_livres()` | Sempre dinâmico |
| Criar agendamento | `criar_agendamento(dados)` | Escrita no sistema |

### O que é verificado localmente (base/ em memória)
- Cobertura do convênio para a especialidade — `checkCobertura()` sobre `convenios.json`
- Nunca jogar `convenios.json` inteiro no prompt — são centenas de registros, estoura contexto

---

## Anti-alucinação e Qualidade de Resposta

### Regras no system prompt
- **Nunca inventar horários, nomes de médicos ou dados do paciente** — usar apenas o retorno das ferramentas
- **Nunca citar valores de convênio** — apenas informar se há ou não cobertura
- **Fora do escopo** → redirecionar para agendamento ou escalar para atendente; nunca tentar responder

### Controle de contexto
- Estado estruturado (Postgres checkpoint) preserva dados confirmados mesmo com histórico truncado
- Histórico de mensagens truncado para as últimas 10-15 — o estado compensa o que foi cortado
- A cada turno o LLM recebe o estado atual explícito no prompt, eliminando ambiguidade

### Válvula de escape
Qualquer situação não mapeada vira escalação para humano — melhor transferir do que responder errado.

---

## Ferramentas (MCP)

- `buscar_pacientes`
- `criar_paciente`
- `proximos_horarios_livres`
- `criar_agendamento`
- `listar_convenios` (para planos de um convênio específico)

---

## Regras de Negócio

### Fluxo de atendimento
1. Identificar o paciente (nome completo, CPF, data de nascimento)
2. Coletar convênio e plano
3. Verificar cobertura da especialidade desejada
4. Se cobre → oferecer horários disponíveis (dia, hora, médico)
5. Se não cobre → oferecer particular por **R$125,00** com 15 dias de retorno
6. Confirmar agendamento

### Retorno
- **Particular / semi-particular**: retorno em até **15 dias**, sempre com o **mesmo médico**
- **Convênio**: retorno somente após **31 dias**, sempre com o **mesmo médico**
- Nunca informar ao paciente o motivo do prazo de 31 dias — apenas passar a data disponível após o período
- Verificar "Últimas passagens" do paciente antes de agendar para detectar se é retorno

### Preço
- Consulta particular: **R$125,00**, pago no ato da consulta
- Nunca citar valores de convênio — apenas informar se há ou não cobertura
- Se o paciente perguntar sobre preços de convênio → escalar para atendente humano

### Dados do WhatsApp
- O histórico da conversa com o bot já pode conter dados cadastrais — sempre verificar antes de perguntar novamente
- Nunca repetir perguntas para dados que já estão no histórico

### Escalação obrigatória
- Paciente quer cancelar ou remarcar consulta existente
- Paciente pergunta sobre valores de convênio
- Convênio não identificado após 2 tentativas
- Paciente solicita falar com atendente
- Erro de API após retentativas

---

## Few-shots

### Caso 1 — Fluxo completo com convênio (script WhatsApp)

```
Paciente: Boa tarde, gostaria de agendar uma consulta com vascular.
Ana: Boa tarde! Claro, vou te ajudar com isso. 😊 Me informa seu nome completo, CPF e data de nascimento, e também o convênio e o plano, por gentileza?
Paciente: Meu nome é João Silva, CPF 123.456.789-00, nascido em 15/03/1980, tenho Bradesco Saúde, plano Nacional Flex.
Ana: Obrigada, João! Um momento enquanto verifico a cobertura do seu plano para Cirurgia Vascular... ✅ Seu convênio possui cobertura! Temos agenda disponível na terça-feira, 22/07 às 14h00 com o Dr. Carlos Rocha. Confirmo o agendamento?
Paciente: Pode confirmar!
Ana: Perfeito! Agendamento confirmado para terça-feira, 22/07 às 14h00 com o Dr. Carlos Rocha. Posso ajudar com mais alguma coisa?
Paciente: Não, obrigado.
Ana: A Clínica ComVida agradece! Tenha um excelente dia! 😊
```

### Caso 2 — Convênio sem cobertura → oferta particular

```
Paciente: Quero agendar dermatologia, meu plano é Amil 400.
Ana: Entendido! Verificando a cobertura do Amil 400 para Dermatologia... Infelizmente esse plano não possui cobertura para essa especialidade. Porém, oferecemos atendimento particular por R$125,00, com direito a retorno em até 15 dias. Gostaria de agendar dessa forma?
Paciente: Tudo bem, pode agendar.
Ana: Ótimo! Temos disponibilidade na quinta-feira, 24/07 às 10h30 com a Dra. Ana Lima. Confirmo?
Paciente: Sim!
Ana: Agendamento confirmado! Quinta-feira, 24/07 às 10h30 com a Dra. Ana Lima. O pagamento de R$125,00 é realizado no ato da consulta. Até lá! 😊
```

### Caso 3 — Paciente fornece tudo na primeira mensagem

```
Paciente: Oi, quero marcar cardiologia, meu nome é Maria Costa, CPF 987.654.321-00, nasci em 20/06/1975, tenho Unimed.
Ana: Olá, Maria! Já tenho seus dados. Qual é o nome do seu plano Unimed?
Paciente: Unimed Unipart Nacional.
Ana: Perfeito! Verificando cobertura... ✅ Seu plano cobre Cardiologia. Temos horários disponíveis:
• Quarta, 23/07 às 08h30
• Quinta, 24/07 às 15h00
• Sexta, 25/07 às 09h00
Qual você prefere?
Paciente: Quarta de manhã.
Ana: Confirmado! Quarta-feira, 23/07 às 08h30 com o Dr. João Silva. Posso ajudar com mais alguma coisa?
```

### Caso 4 — Paciente descreve sintoma em vez de especialidade

```
Paciente: Estou com dor no coração, quero marcar uma consulta.
Ana: Entendo! Para dores no coração, o indicado é a Cardiologia. Vou verificar a disponibilidade. Antes, me informa seu nome completo, CPF, data de nascimento e convênio?
```

### Caso 5 — Paciente pergunta sobre preço de convênio → escalação

```
Paciente: Quanto custa a consulta pelo meu Bradesco?
Ana: Sobre valores de convênio, preciso transferir você para um de nossos atendentes que poderá te informar com precisão. Um momento!
```

### Caso 6 — Paciente quer cancelar consulta → escalação

```
Paciente: Quero cancelar minha consulta de amanhã.
Ana: Para cancelamentos, vou transferir você para um de nossos atendentes. Um momento, por favor!
```

### Caso 7 — Paciente muda de especialidade no meio do fluxo

```
Paciente: Na verdade, esquece vascular. Quero agendar ortopedia.
Ana: Claro! Vou verificar a disponibilidade para Ortopedia com seu convênio. Um momento... ✅ Temos agenda disponível. Qual período você prefere, manhã ou tarde?
```

### Caso 8 — Retorno dentro do prazo (convênio)

```
[Sistema detecta que paciente consultou há 15 dias com convênio]
Ana: Verifiquei que sua última consulta foi recente. Com convênio, o retorno com o mesmo médico fica disponível a partir de [data 31 dias após última consulta]. Posso agendar para essa data ou posterior?
```

---

## O que muda no código

- [ ] Substituir os 6 nós de agente por um único `agenteNode`
- [ ] Criar `src/agent/prompt.ts` com `buildSystemPrompt(state)`
- [ ] Criar `src/agent/extractor.ts` com extração de estado pós-turno
- [ ] Manter `entradaNode` (timeout/horário de atendimento — lógica determinística, não muda)
- [ ] Manter `state.ts`, `graph.ts` (estrutura do grafo), `tools.ts` sem alteração

---

## O que NÃO muda

- Infraestrutura (PostgresSaver, Evolution API, MCP)
- Admin panel
- `base/` (loader, convenio-matcher, cobertura-checker)
- Logger
- Debounce e fila por threadId
