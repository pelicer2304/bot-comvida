"use client";

import React, { useEffect, useState } from "react";
import { Card, Box, Typography, Chip } from "@mui/material";
import { api } from "@/lib/api";

interface Profissional {
  idUsuario: number;
  nome: string;
  especialidades: string[];
}

export default function MedicosPage() {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.getProfissionais().then(setProfissionais).catch(() => {});
  }, []);

  const filtered = profissionais.filter(
    (p) =>
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.especialidades.some((e) => e.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Box sx={{ p: { xs: "18px", sm: "25px" } }}>
      <Card sx={{ boxShadow: "none", borderRadius: "7px", p: { xs: "18px", sm: "25px" } }} className="rmui-card">
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "25px", flexWrap: "wrap", gap: "12px" }}>
          <Typography variant="h3" sx={{ fontSize: "18px", fontWeight: 700 }} className="text-black">
            Médicos ({filtered.length})
          </Typography>
          <form className="t-search-form">
            <label><i className="material-symbols-outlined">search</i></label>
            <input
              type="text"
              className="t-input"
              placeholder="Nome ou especialidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: "1px" }}>
          {filtered.map((p) => (
            <Box
              key={p.idUsuario}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                py: "12px",
                px: "4px",
                borderBottom: "1px solid #f6f7f9",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <Typography sx={{ fontSize: "14px", fontWeight: 500, minWidth: "200px" }} className="text-black">
                {p.nome}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {p.especialidades.length === 0 ? (
                  <Typography sx={{ fontSize: "12px", color: "#999" }}>—</Typography>
                ) : (
                  p.especialidades.map((e) => (
                    <Chip key={e} label={e} size="small" variant="outlined" sx={{ fontSize: "12px" }} />
                  ))
                )}
              </Box>
            </Box>
          ))}
          {filtered.length === 0 && (
            <Typography sx={{ color: "#666", fontSize: "14px", py: "20px", textAlign: "center" }}>
              Nenhum médico encontrado.
            </Typography>
          )}
        </Box>
      </Card>
    </Box>
  );
}
