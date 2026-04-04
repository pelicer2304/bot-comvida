"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, Box, Typography, Button, Chip, Switch, TextField, Alert } from "@mui/material";
import { api, BotConfig } from "@/lib/api";

const DIAS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
const DIAS_LABEL: Record<string, string> = { segunda: "Segunda", terca: "Terça", quarta: "Quarta", quinta: "Quinta", sexta: "Sexta", sabado: "Sábado", domingo: "Domingo" };

export default function ConfigPage() {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.getConfig().then(setConfig).catch(() => {}); }, []);

  function update(patch: Partial<BotConfig>) {
    setConfig((c) => c ? { ...c, ...patch } : c);
  }

  function updateHorario(dia: string, field: string, value: unknown) {
    setConfig((c) => {
      if (!c) return c;
      return { ...c, horarioAtendimento: { ...c.horarioAtendimento, [dia]: { ...c.horarioAtendimento[dia], [field]: value } } };
    });
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setSaved(false);
    await api.patchConfig(config).catch(() => {});
    setSaving(false);
    setSaved(true);
  }

  if (!config) return <Box sx={{ p: "25px" }}><Typography>Carregando...</Typography></Box>;

  return (
    <Box sx={{ p: { xs: "18px", sm: "25px" } }}>
      <Typography variant="h2" sx={{ fontSize: "20px", fontWeight: 700, mb: "20px" }} className="text-black">
        Configurações do Bot
      </Typography>

      {saved && <Alert severity="success" sx={{ mb: "16px" }}>Configurações salvas!</Alert>}

      <Card sx={{ boxShadow: "none", borderRadius: "7px", p: "25px", mb: "25px" }} className="rmui-card">
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "20px" }}>
          <Typography sx={{ fontWeight: 600, fontSize: "16px" }} className="text-black">Bot ativo</Typography>
          <Switch checked={config.botAtivo} onChange={(e) => update({ botAtivo: e.target.checked })} />
        </Box>

        <TextField fullWidth label="Mensagem de boas-vindas" value={config.mensagemBoasVindas} onChange={(e) => update({ mensagemBoasVindas: e.target.value })} sx={{ mb: "16px", "& .MuiInputBase-root": { borderRadius: "7px" } }} />
        <TextField fullWidth label="Mensagem fora do horário" value={config.mensagemForaHorario} onChange={(e) => update({ mensagemForaHorario: e.target.value })} sx={{ mb: "16px", "& .MuiInputBase-root": { borderRadius: "7px" } }} />
        <TextField fullWidth type="number" label="Máx. tentativas por step" value={config.maxTentativasPorStep} onChange={(e) => update({ maxTentativasPorStep: Number(e.target.value) })} sx={{ mb: "16px", "& .MuiInputBase-root": { borderRadius: "7px" } }} />
      </Card>

      <Card sx={{ boxShadow: "none", borderRadius: "7px", p: "25px", mb: "25px" }} className="rmui-card">
        <Typography sx={{ fontWeight: 600, fontSize: "16px", mb: "16px" }} className="text-black">Horário de atendimento</Typography>
        {DIAS.map((dia) => {
          const h = config.horarioAtendimento[dia] ?? { ativo: false, inicio: "08:00", fim: "18:00" };
          return (
            <Box key={dia} sx={{ display: "flex", alignItems: "center", gap: "16px", mb: "12px", flexWrap: "wrap" }}>
              <Box sx={{ width: "90px" }}>
                <Typography sx={{ fontSize: "14px" }} className="text-black">{DIAS_LABEL[dia]}</Typography>
              </Box>
              <Switch checked={h.ativo} onChange={(e) => updateHorario(dia, "ativo", e.target.checked)} size="small" />
              <TextField type="time" size="small" value={h.inicio} disabled={!h.ativo} onChange={(e) => updateHorario(dia, "inicio", e.target.value)} sx={{ width: "130px", "& .MuiInputBase-root": { borderRadius: "7px" } }} />
              <Typography sx={{ fontSize: "13px", color: "#666" }}>até</Typography>
              <TextField type="time" size="small" value={h.fim} disabled={!h.ativo} onChange={(e) => updateHorario(dia, "fim", e.target.value)} sx={{ width: "130px", "& .MuiInputBase-root": { borderRadius: "7px" } }} />
            </Box>
          );
        })}
      </Card>

      <Button variant="contained" disabled={saving} onClick={handleSave} sx={{ textTransform: "capitalize", borderRadius: "6px", color: "#fff !important", boxShadow: "none", px: "32px", py: "12px" }}>
        {saving ? "Salvando..." : "Salvar configurações"}
      </Button>
    </Box>
  );
}
