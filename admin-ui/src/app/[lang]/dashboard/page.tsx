"use client";

import React, { useEffect, useState } from "react";
import { Grid, Card, Box, Typography } from "@mui/material";
import { api, Metrics, SessionSummary } from "@/lib/api";

const STEP_LABEL: Record<string, string> = {
  identificacao: "Identificando",
  convenio: "Convênio",
  especialidade: "Especialidade",
  horarios: "Horários",
  confirmacao: "Confirmação",
  concluido: "Concluído",
  escalado: "🚨 Escalado",
  resetado: "Reiniciado",
};

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card sx={{ boxShadow: "none", borderRadius: "7px", p: "20px" }} className="rmui-card">
      <Typography sx={{ fontSize: "13px", color: "#666", mb: "8px" }}>{label}</Typography>
      <Typography sx={{ fontSize: "28px", fontWeight: 700, color: color ?? "inherit" }} className="text-black">
        {value}
      </Typography>
    </Card>
  );
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [escaladas, setEscaladas] = useState<SessionSummary[]>([]);

  useEffect(() => {
    api.getMetrics("hoje").then(setMetrics).catch(() => {});
    api.getEscaladas().then(setEscaladas).catch(() => {});
    const t = setInterval(() => api.getEscaladas().then(setEscaladas).catch(() => {}), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <Box sx={{ p: { xs: "18px", sm: "25px" } }}>
      <Typography variant="h2" sx={{ fontSize: "20px", fontWeight: 700, mb: "20px" }} className="text-black">
        Dashboard — Hoje
      </Typography>

      <Grid container spacing={3} sx={{ mb: "25px" }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Conversas hoje" value={metrics?.totalConversas ?? "—"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Agendamentos concluídos" value={metrics?.agendamentosConcluidos ?? "—"} color="#00a76f" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Escalamentos" value={metrics?.escalamentos ?? escaladas.length} color={escaladas.length > 0 ? "#d32f2f" : undefined} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Tempo médio (min)" value={metrics?.tempoMedioMinutos?.toFixed(1) ?? "—"} />
        </Grid>
      </Grid>

      {escaladas.length > 0 && (
        <Card sx={{ boxShadow: "none", borderRadius: "7px", p: "20px", mb: "25px", border: "1px solid #ffcdd2" }} className="rmui-card">
          <Typography sx={{ fontSize: "16px", fontWeight: 700, mb: "12px", color: "#d32f2f" }}>
            🚨 Sessões aguardando atendimento humano ({escaladas.length})
          </Typography>
          {escaladas.map((s) => (
            <Box key={s.threadId} sx={{ display: "flex", justifyContent: "space-between", py: "8px", borderBottom: "1px solid #f5f5f5" }}>
              <Typography sx={{ fontSize: "14px" }} className="text-black">
                {s.pacienteNome ?? s.threadId.slice(0, 20) + "…"}
              </Typography>
              <Typography sx={{ fontSize: "12px", color: "#666" }}>
                {new Date(s.lastActivityAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </Typography>
            </Box>
          ))}
        </Card>
      )}
    </Box>
  );
}
