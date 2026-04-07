export interface ZApiWebhookPayload {
  isStatusReply?: boolean;
  connectedPhone?: string;
  waitingMessage?: boolean;
  isEdit?: boolean;
  isGroup?: boolean;
  isNewsletter?: boolean;
  instanceId?: string;
  messageId?: string;
  phone?: string;
  fromMe?: boolean;
  momment?: number;
  status?: string;
  chatName?: string;
  senderName?: string;
  type?: string;
  text?: { message?: string };
  buttonsResponseMessage?: { buttonId?: string; message?: string };
  listResponseMessage?: { message?: string; title?: string; selectedRowId?: string };
}
