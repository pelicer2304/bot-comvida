# Z-API — Mapeamento Técnico para Integração

## Resumo

Documentação extraída de https://developer.z-api.io/ com tudo que precisamos para a Sprint 8.

---

## 1. Autenticação

Toda chamada usa a URL com instance-id e token + header Client-Token:

```
POST https://api.z-api.io/instances/{INSTANCE_ID}/token/{TOKEN}/{endpoint}
Header: Client-Token: {CLIENT_TOKEN}
Header: Content-Type: application/json
```

**Env vars necessárias:**
```
ZAPI_INSTANCE_ID=    # ID da instância (painel Z-API)
ZAPI_TOKEN=          # Token da instância (painel Z-API)
ZAPI_CLIENT_TOKEN=   # Token de segurança da conta (configurações)
```

---

## 2. Enviar Texto Simples

**Endpoint:** `POST /send-text`

```json
{
  "phone": "5511999999999",
  "message": "Welcome to *Z-API*"
}
```

**Response 200:**
```json
{
  "zaapId": "3999984263738042930CD6ECDE9VDWSA",
  "messageId": "D241XXXX732339502B68",
  "id": "D241XXXX732339502B68"
}
```

**Notas:**
- `phone`: formato DDI+DDD+NÚMERO, somente números (ex: `5511999999999`)
- Suporta formatação WhatsApp: `*negrito*`, `_itálico_`, `~tachado~`, `` ```monospace``` ``
- Quebra de linha: `\n`

---

## 3. Enviar Texto com Botões

**Endpoint:** `POST /send-button-list`

```json
{
  "phone": "5511999999999",
  "message": "Z-API é Bom ?",
  "buttonList": {
    "buttons": [
      { "id": "1", "label": "Ótimo" },
      { "id": "2", "label": "Excelente" }
    ]
  }
}
```

**Notas:**
- `message` NÃO pode ser vazio
- `id` é opcional mas recomendado (usamos pra identificar a resposta)
- `label` é o texto visível do botão
- ⚠️ Botões têm limitações — ver seção "Funcionamento dos Botões" na doc

---

## 4. Enviar Lista de Opções

**Endpoint:** `POST /send-option-list`

```json
{
  "phone": "5511999999999",
  "message": "Selecione a melhor opção:",
  "optionList": {
    "title": "Opções disponíveis",
    "buttonLabel": "Abrir lista de opções",
    "options": [
      { "id": "1", "description": "Descrição da opção", "title": "Opção 1" },
      { "id": "2", "description": "Outra descrição", "title": "Opção 2" }
    ]
  }
}
```

**Notas:**
- `title`: título da listagem
- `buttonLabel`: texto do botão que abre a lista
- `options[].id`: identificador (opcional mas recomendado)
- `options[].title`: texto principal da opção
- `options[].description`: texto secundário
- ⚠️ NÃO funciona em grupos (descontinuado pelo WhatsApp)

---

## 5. Webhook — Receber Mensagens

**Configuração:** No painel Z-API, configurar URL do webhook:
```
PUT /update-webhook-received
Body: { "value": "https://seu-dominio.com/webhook/zapi" }
```

**Payload recebido (texto simples):**
```json
{
  "isStatusReply": false,
  "connectedPhone": "554499999999",
  "waitingMessage": false,
  "isEdit": false,
  "isGroup": false,
  "instanceId": "A20DA9C0183A2D35A260F53F5D2B9244",
  "messageId": "A20DA9C0183A2D35A260F53F5D2B9244",
  "phone": "5544999999999",
  "fromMe": false,
  "momment": 1632228638000,
  "status": "RECEIVED",
  "chatName": "name",
  "senderName": "name",
  "type": "ReceivedCallback",
  "text": {
    "message": "teste"
  }
}
```

**Payload recebido (resposta de botão):**
```json
{
  "phone": "5544999999999",
  "fromMe": false,
  "type": "ReceivedCallback",
  "buttonsResponseMessage": {
    "buttonId": "1",
    "message": "Ótimo"
  }
}
```

**Payload recebido (resposta de lista de opções):**
```json
{
  "phone": "5544999999999",
  "fromMe": false,
  "type": "ReceivedCallback",
  "listResponseMessage": {
    "message": "Descrição da opção",
    "title": "Opção 1",
    "selectedRowId": "1"
  }
}
```

---

## 6. Campos Importantes do Webhook

| Campo | Tipo | Uso |
|---|---|---|
| `phone` | string | Número do remetente (DDI+DDD+NUM) |
| `fromMe` | boolean | `true` = mensagem enviada por nós → **ignorar** |
| `isGroup` | boolean | `true` = grupo → **ignorar** |
| `type` | string | Sempre `"ReceivedCallback"` |
| `messageId` | string | ID único da mensagem (pra deduplicação) |
| `text.message` | string | Texto da mensagem (quando é texto simples) |
| `buttonsResponseMessage.buttonId` | string | ID do botão clicado |
| `buttonsResponseMessage.message` | string | Label do botão clicado |
| `listResponseMessage.selectedRowId` | string | ID da opção selecionada na lista |
| `listResponseMessage.title` | string | Título da opção selecionada |

---

## 7. Mapeamento BotResponse → Z-API

| BotResponse type | Endpoint Z-API | Mapeamento |
|---|---|---|
| `text` | `send-text` | `{ phone, message: text }` |
| `buttons` | `send-button-list` | `{ phone, message: text, buttonList: { buttons: [{id, label}] } }` |
| `list` | `send-option-list` | `{ phone, message: text, optionList: { title, buttonLabel, options: [{id, title, description}] } }` |

---

## 8. Mapeamento Webhook → processMessage

```typescript
function extractInput(payload: ZApiWebhook): string {
  // Resposta de botão
  if (payload.buttonsResponseMessage) {
    return payload.buttonsResponseMessage.buttonId;
  }
  // Resposta de lista
  if (payload.listResponseMessage) {
    return payload.listResponseMessage.selectedRowId;
  }
  // Texto simples
  if (payload.text?.message) {
    return payload.text.message;
  }
  return '';
}
```

---

## 9. Configuração no Painel Z-API

1. Criar conta em z-api.io
2. Criar instância (plano básico serve)
3. Escanear QR code com o WhatsApp
4. Em **Configurações > Webhooks**, configurar:
   - Webhook de recebimento: `https://seu-dominio.com/webhook/zapi`
5. Em **Configurações > Segurança**, copiar:
   - Instance ID
   - Token
   - Client-Token

---

## 10. Limitações Conhecidas

- **Botões**: Podem não funcionar em todos os dispositivos/versões do WhatsApp. A Z-API tem uma página dedicada sobre isso: `/tips/button-status`
- **Listas**: NÃO funcionam em grupos (descontinuado pelo WhatsApp)
- **Formato phone**: Somente números, sem `+`, `-`, espaços ou parênteses
- **Delay**: Por padrão, Z-API adiciona delay de 1-3s entre mensagens. Configurável via `delayMessage` (1-15s)
