"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, Box, Typography, Button, Select, MenuItem, Divider } from "@mui/material";
import { api, Agendamento } from "@/lib/api";

const STATUS_OPTIONS = [
  { value: 0, label: "Cancelado" },
  { value: 1, label: "Aguarda" },
  { value: 2, label: "Confirmado" },
  { value: 3, label: "Não chegou" },
];

export default function AgendamentoDetailPage() {
  const { lang, id } = useParams();
  const router = useRouter();
  const [agendamento, setAgendamento] = useState<Agendamento | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load the day's agendamentos and find by id
    const today = new Date().toISOString().split("T")[0];
    api.getAgendamentos(today).then((list) => {
      const found = list.find((a) => String(a.codAgendamento) === String(id));
      if (found) setAgendamento(found);
    }).catch(() => {});
  }, [id]);

  async function handleStatusChange(idStatus: number) {
    if (!agendamento) return;
    setSaving(true);
    await api.patchAgendamentoStatus(agendamento.codAgendamento, idStatus).catch(() => {});
    setAgendamento((prev) => prev ? { ...prev, status: idStatus } : prev);
    setSaving(false);
  }

  if (!agendamento) {
    return (
      <Box sx={{ p: { xs: "18px", sm: "25px" } }}>
        <Typography>Carregando...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: "18px", sm: "25px" } }}>
      <Button variant="text" onClick={() => router.push(`/${lang}/agendamentos/`)} sx={{ mb: "16px", textTransform: "none" }}>
        ← Voltar
      </Button>

      <Card sx={{ boxShadow: "none", borderRadius: "7px", p: { xs: "18px", sm: "25px" } }} className="rmui-card">
        <Typography variant="h3" sx={{ fontSize: "18px", fontWeight: 700, mb: "20px" }} className="text-black">
          Agendamento #{agendamento.codAgendamento}
        </Typography>

        <Divider sx={{ mb: "20px" }} />

        {[
          ["Data", agendamento.data],
          ["Horário", agendamento.hora],
          ["Paciente", agendamento.pacienteNome],
          ["Convênio", agendamento.convenioNome],
          ["Criado pelo bot", agendamento.criadoPeloBot ? "Sim" : "Não"],
        ].map(([label, value]) => (
          <Box key={label as string} sx={{ display: "flex", gap: "12px", mb: "12px", alignItems: "center" }}>
            <Typography sx={{ fontSize: "13px", color: "#666", minWidth: "140px" }}>{label}</Typography>
            <Typography sx={{ fontSize: "14px" }} className="text-black">{value as string}</Typography>
          </Box>
        ))}

        <Box sx={{ display: "flex", gap: "12px", mt: "20px", alignItems: "center" }}>
          <Typography sx={{ fontSize: "13px", color: "#666", minWidth: "140px" }}>Status</Typography>
          <Select
            size="small"
            value={agendamento.status}
            disabled={saving}
            onChange={(e) => handleStatusChange(Number(e.target.value))}
            sx={{ fontSize: "13px", borderRadius: "6px" }}
          >
            {STATUS_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
        </Box>
      </Card>
    </Box>
  );
}
