"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, Box, Typography, TextField, Button, Alert } from "@mui/material";
import { api, Convenio } from "@/lib/api";

export default function ConvenioEditPage() {
  const { lang, id } = useParams();
  const router = useRouter();
  const [convenio, setConvenio] = useState<Convenio | null>(null);
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getConvenio(Number(id)).then((c) => { setConvenio(c); setObservacao(c.observacao ?? ""); }).catch(() => {});
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await api.patchConvenio(Number(id), observacao).catch(() => {});
    setSaving(false);
    setSaved(true);
  }

  if (!convenio) return <Box sx={{ p: "25px" }}><Typography>Carregando...</Typography></Box>;

  return (
    <Box sx={{ p: { xs: "18px", sm: "25px" } }}>
      <Button variant="text" onClick={() => router.push(`/${lang}/convenios/`)} sx={{ mb: "16px", textTransform: "none" }}>
        ← Voltar
      </Button>

      <Card sx={{ boxShadow: "none", borderRadius: "7px", p: "25px" }} className="rmui-card">
        <Typography variant="h3" sx={{ fontSize: "18px", fontWeight: 700, mb: "4px" }} className="text-black">
          {convenio.descricaoConvenio}
        </Typography>
        <Typography sx={{ fontSize: "13px", color: "#666", mb: "24px" }}>
          ANS: {convenio.codANS} · {convenio.planos?.length ?? 0} planos
        </Typography>

        {convenio.planos?.length > 0 && (
          <Box sx={{ mb: "24px" }}>
            <Typography sx={{ fontWeight: 500, fontSize: "14px", mb: "10px" }} className="text-black">Planos</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {convenio.planos.map((p) => (
                <Box key={p.codPlano} sx={{ border: "1px solid #e0e0e0", borderRadius: "6px", px: "12px", py: "6px", fontSize: "13px" }} className="text-black">
                  {p.plano} <Typography component="span" sx={{ fontSize: "11px", color: "#999" }}>#{p.codPlano}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
        {saved && <Alert severity="success" sx={{ mb: "16px" }}>Observação salva com sucesso!</Alert>}

        <Typography component="label" sx={{ fontWeight: 500, fontSize: "14px", mb: "8px", display: "block" }} className="text-black">
          Observação (regras de cobertura usadas pelo bot)
        </Typography>
        <TextField
          multiline
          rows={10}
          fullWidth
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex: Especialidades cobertas: Cardiologia, Ortopedia. NÃO ATENDEMOS Gastro."
          sx={{ mb: "20px", "& .MuiInputBase-root": { borderRadius: "7px", fontFamily: "monospace", fontSize: "13px" } }}
        />

        <Button variant="contained" disabled={saving} onClick={handleSave} sx={{ textTransform: "capitalize", borderRadius: "6px", color: "#fff !important", boxShadow: "none" }}>
          {saving ? "Salvando..." : "Salvar observação"}
        </Button>
      </Card>
    </Box>
  );
}
