"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, Box, Typography, Button, Chip } from "@mui/material";
import { api, SessionDetail, LogEntry } from "@/lib/api";

const STEP_LABEL: Record<string, string> = {
  identificacao: "Identificando paciente",
  convenio: "Coletando convênio",
  especialidade: "Escolhendo especialidade",
  horarios: "Selecionando horário",
  confirmacao: "Aguardando confirmação",
  concluido: "Agendamento concluído",
  escalado: "🚨 Fallback humano",
  resetado: "Reiniciado",
};

export default function SessaoDetailPage() {
  const { lang, id } = useParams();
  const threadId = decodeURIComponent(id as string);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [messages, setMessages] = useState<LogEntry[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [assuming, setAssuming] = useState(false);

  useEffect(() => {
    api.getSession(threadId).then(setSession).catch(() => {});
    api.getSessionMessages(threadId).then(setMessages).catch(() => {});
  }, [threadId]);

  async function handleDelete() {
    if (!confirm("Reiniciar esta sessão?")) return;
    setDeleting(true);
    await api.deleteSession(threadId).catch(() => {});
    setDeleting(false);
    window.location.href = `/${lang}/sessoes/`;
  }

  async function handleAssumir() {
    if (!confirm("Assumir atendimento? O bot será pausado nesta sessão.")) return;
    setAssuming(true);
    await api.assumirAtendimento(threadId).catch(() => {});
    setAssuming(false);
    api.getSession(threadId).then(setSession).catch(() => {});
  }

  return (
    <Box sx={{ p: { xs: "18px", sm: "25px" } }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "20px" }}>
        <Typography variant="h2" sx={{ fontSize: "18px", fontWeight: 700 }} className="text-black">
          Sessão: {threadId.slice(0, 30)}…
        </Typography>
        <Box sx={{ display: "flex", gap: "8px" }}>
          {session?.step === "escalado" && (
            <Button variant="contained" color="warning" size="small" disabled={assuming} onClick={handleAssumir}>
              Assumir atendimento
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            href={api.exportSessionCsv(threadId)}
            target="_blank"
          >
            Exportar CSV
          </Button>
          <Button variant="outlined" color="error" size="small" disabled={deleting} onClick={handleDelete}>
            Reiniciar sessão
          </Button>
        </Box>
      </Box>

      {session && (
        <Card sx={{ boxShadow: "none", borderRadius: "7px", p: "20px", mb: "25px" }} className="rmui-card">
          <Box sx={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Chip label={STEP_LABEL[session.step] ?? session.step} color={session.step === "escalado" ? "error" : session.step === "concluido" ? "success" : "default"} />
            {session.paciente && <Chip label={`Paciente: ${session.paciente.nome}`} variant="outlined" />}
            {session.convenio && <Chip label={`Convênio: ${session.convenio.nome}`} variant="outlined" />}
            {session.especialidade && <Chip label={`Especialidade: ${session.especialidade.nome}`} variant="outlined" />}
            {session.horario && <Chip label={`Horário: ${session.horario.data} ${session.horario.hora}`} variant="outlined" />}
            {session.agendamentoId && <Chip label={`Agendamento #${session.agendamentoId}`} color="success" variant="outlined" />}
          </Box>
        </Card>
      )}

      <Card sx={{ boxShadow: "none", borderRadius: "7px", p: "20px" }} className="rmui-card">
        <Typography sx={{ fontSize: "16px", fontWeight: 700, mb: "16px" }} className="text-black">
          Histórico da conversa
        </Typography>
        <Box className="t-chat-body">
          <ul>
            {messages.map((m, i) => (
              <li key={i} className={m.role === "user" ? "right" : ""}>
                <Box className="message">
                  <Box>
                    <Typography>{m.message}</Typography>
                  </Box>
                </Box>
                <Typography component="span" className="time">
                  {new Date(m.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </Typography>
              </li>
            ))}
            {messages.length === 0 && (
              <Typography sx={{ color: "#666", fontSize: "14px" }}>Nenhuma mensagem registrada.</Typography>
            )}
          </ul>
        </Box>
      </Card>
    </Box>
  );
}
