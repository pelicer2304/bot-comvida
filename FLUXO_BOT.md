# Fluxo Conversacional — Bot de Agendamento Clínica ComVida

## Visão Geral

O bot deve conduzir o paciente pelo caminho mais curto possível até o agendamento confirmado, coletando apenas o necessário em cada etapa e tratando desvios de forma natural, sem parecer um formulário.

---

## ETAPA 1 — Identificação do Paciente

### Caminho feliz
1. Bot solicita **nome completo, CPF e data de nascimento** em uma única mensagem
2. Bot busca o paciente na API (`GET /pacientes?codEmpresa=&query={cpf}`)
3. Paciente encontrado → bot confirma: _"Encontrei seu cadastro, {nome}. Pode confirmar?"_
4. Paciente confirma → segue para **Etapa 2**

### Caminhos alternativos
| Situação | Ação |
|---|---|
| Paciente não encontrado na base | Bot informa que vai criar o cadastro e coleta: nome completo, CPF, data de nascimento, sexo, e-mail, DDD + celular → `POST /pacientes` |
| Paciente nega o cadastro encontrado | Bot pede para confirmar os dados ou oferece falar com atendente |
| CPF inválido / não informado | Bot pede novamente de forma gentil, máximo 2 tentativas → transfere para humano |

---

## ETAPA 2 — Convênio e Plano

### Caminho feliz
1. Bot pergunta: _"Você tem algum convênio? Se sim, qual?"_
2. Paciente informa o convênio → bot busca em `base/convenios.json` por similaridade no nome
3. Bot confirma o convênio: _"Encontrei a [nome do convênio]. Qual é o seu plano?"_ e lista os planos disponíveis daquele convênio
4. Paciente informa o plano → bot confirma → segue para **Etapa 3**

### Caminhos alternativos
| Situação | Ação |
|---|---|
| Paciente diz que não tem convênio / é particular | Define `codConvenio=-1`, `codPlano=-2` → segue para **Etapa 3** |
| Convênio não encontrado na base | Bot informa que não trabalha com aquele convênio e pergunta: _"Gostaria de agendar como particular?"_ |
| Paciente não sabe o nome do plano | Bot lista os planos do convênio para o paciente reconhecer o seu |
| Paciente pergunta valor do particular | Bot responde que não tem essa informação e transfere para atendente humano |
| Paciente insiste em saber o valor | Transferência imediata para humano, sem tentar responder |

---

## ETAPA 3 — Especialidade e Verificação de Cobertura

### Caminho feliz
1. Bot pergunta: _"Qual especialidade ou tipo de consulta você precisa?"_
2. Bot identifica a especialidade na lista de `base/profissionais.json`
3. Bot verifica no campo `observacao` do convênio (`base/convenios.json`) se aquela especialidade é atendida pelo plano
4. Especialidade coberta → segue para **Etapa 4**

### Lógica de verificação da observação
- Busca textual no campo `observacao` do convênio pelo nome da especialidade
- Se encontrar menção positiva → cobertura confirmada
- Se encontrar menção negativa (ex: "NÃO ATENDEMOS", "COM PEDIDO MÉDICO") → bot informa a restrição
- Se `observacao` for `null` ou não mencionar → bot assume cobertura e segue, mas avisa que pode ser necessário confirmar na recepção

### Caminhos alternativos
| Situação | Ação |
|---|---|
| Especialidade não coberta pelo convênio | Bot informa e oferece consulta particular |
| Especialidade requer pedido médico | Bot informa a exigência e pergunta se o paciente tem o pedido |
| Paciente aceita particular após negativa | Redefine `codConvenio=-1`, `codPlano=-2` → segue para **Etapa 4** |
| Paciente recusa particular | Bot encerra com gentileza e oferece contato da recepção |
| Especialidade não reconhecida | Bot pede para reformular ou oferece lista de especialidades disponíveis |

---

## ETAPA 4 — Busca de Horários Disponíveis

### Caminho feliz
1. Bot identifica os profissionais que atendem a especialidade (`base/profissionais.json`)
2. Bot busca horários livres nos próximos 7 dias para cada profissional (`GET /agendamentos/livres`)
3. Bot apresenta até **3 opções** de horário de forma resumida: _"Tenho disponível: Terça 10/06 às 14h com Dr. X ou Quarta 11/06 às 09h com Dra. Y. Qual prefere?"_
4. Paciente escolhe → segue para **Etapa 5**

### Caminhos alternativos
| Situação | Ação |
|---|---|
| Nenhum horário nos próximos 7 dias | Expande busca para 15 dias e tenta novamente |
| Nenhum horário em 15 dias | Bot informa indisponibilidade e oferece entrar em lista de espera ou falar com recepção |
| Paciente pede horário específico (ex: "só de manhã") | Filtra as opções e reapresenta |
| Paciente pede médico específico | Busca horários somente para aquele profissional |
| Paciente não gosta de nenhuma opção | Oferece mais opções ou transfere para humano |

---

## ETAPA 5 — Confirmação e Criação do Agendamento

### Caminho feliz
1. Bot apresenta resumo: _"Vou agendar: [especialidade] com [médico] em [data] às [hora], pelo convênio [nome]. Confirma?"_
2. Paciente confirma → bot cria o agendamento (`POST /agendamentos` com `codStatus=2`)
3. Agendamento criado com sucesso → bot confirma: _"Agendamento confirmado! Anote: [data], [hora], [médico]. Até lá!"_

### Caminhos alternativos
| Situação | Ação |
|---|---|
| Paciente quer alterar algo | Volta para a etapa correspondente |
| Erro na criação do agendamento (API) | Bot informa o problema e transfere para humano |
| Paciente cancela | Bot encerra com gentileza e informa como reagendar |

---

## ETAPA 6 — Transferência para Humano

Acionada automaticamente nos seguintes casos:
- Paciente pergunta **valor de consulta** (particular ou convênio)
- Paciente **insiste** em algo que o bot não pode resolver após 2 tentativas
- **Erro de API** que impede o agendamento
- Paciente solicita explicitamente falar com atendente
- Fluxo não reconhecido após 3 mensagens sem progresso

Mensagem padrão de transferência:
> _"Vou te conectar com um de nossos atendentes para te ajudar melhor. Um momento!"_

---

## Regras Gerais do Bot

| Regra | Detalhe |
|---|---|
| **Nunca informar valores** | Nem particular, nem convênio. Sempre transferir para humano |
| **Tom natural** | Sem listas de opções numeradas, sem parecer formulário |
| **Máximo de tentativas** | 2 tentativas por campo antes de oferecer ajuda humana |
| **Confirmação antes de criar** | Sempre apresentar resumo antes do `POST /agendamentos` |
| **Cadastro novo** | Criar paciente silenciosamente se não existir, sem interromper o fluxo |
| **Dados sensíveis** | Nunca repetir CPF completo na conversa |

---

## Mapa de Dados por Etapa

| Etapa | Dados coletados | Fonte |
|---|---|---|
| 1 | `idPaciente`, `nome` | API `/pacientes` ou cadastro novo |
| 2 | `codConvenio`, `codPlano` | `base/convenios.json` |
| 3 | especialidade, `idUsuario` do profissional | `base/profissionais.json` + `observacao` do convênio |
| 4 | `data`, `hora`, `intervalo`, `codProcedimento` | API `/agendamentos/livres` |
| 5 | `codSala=0`, `codStatus=2` | fixo |

---

## Diagrama Resumido

```
[Início]
    │
    ▼
[Identificar paciente] ──(não encontrado)──► [Criar cadastro]
    │
    ▼
[Convênio/Plano] ──(particular)──► [codConvenio=-1]
    │
    ▼
[Especialidade] ──(não coberta)──► [Oferecer particular] ──(recusa)──► [Encerrar]
    │
    ▼
[Buscar horários] ──(sem horário)──► [Expandir busca] ──(sem horário)──► [Humano]
    │
    ▼
[Confirmar agendamento]
    │
    ▼
[POST /agendamentos] ──(erro)──► [Humano]
    │
    ▼
[✅ Agendamento confirmado]
```
