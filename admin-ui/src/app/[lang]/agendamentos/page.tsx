"use client";

import React, { useEffect, useState } from "react";
import { Card, Box, Typography, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Select, MenuItem } from "@mui/material";
import { api, Agendamento } from "@/lib/api";

const STATUS_OPTIONS = [
  { value: 0, label: "Cancelado" },
  { value: 1, label: "Aguarda" },
  { value: 2, label: "Confirmado" },
  { value: 3, label: "Não chegou" },
];

const STATUS_BADGE: Record<number, string> = { 0: "Rejected", 1: "Pending", 2: "Confirmed", 3: "Shipped" };

export default function AgendamentosPage() {
  const today = new Date().toISOString().split("T")[0];
  const [data, setData] = useState(today);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(false);

  async function load(d: string) {
    setLoading(true);
    api.getAgendamentos(d).then((r) => setAgendamentos(Array.isArray(r) ? r : [])).catch(() => setAgendamentos([])).finally(() => setLoading(false));
  }

  useEffect(() => { load(data); }, [data]);

  async function changeStatus(cod: number, idStatus: number) {
    await api.patchAgendamentoStatus(cod, idStatus).catch(() => {});
    load(data);
  }

  return (
    <Box sx={{ p: { xs: "18px", sm: "25px" } }}>
      <Card sx={{ boxShadow: "none", borderRadius: "7px", p: { xs: "18px", sm: "25px" } }} className="rmui-card">
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "25px", flexWrap: "wrap", gap: "12px" }}>
          <Typography variant="h3" sx={{ fontSize: "18px", fontWeight: 700 }} className="text-black">
            Agendamentos
          </Typography>
          <TextField
            type="date"
            size="small"
            value={data}
            onChange={(e) => setData(e.target.value)}
            sx={{ "& .MuiInputBase-root": { borderRadius: "7px" } }}
          />
        </Box>

        <TableContainer component={Paper} sx={{ boxShadow: "none", borderRadius: "7px" }} className="rmui-table border">
          <Table sx={{ minWidth: 650 }}>
            <TableHead className="bg-f6f7f9">
              <TableRow sx={{ "& th": { fontWeight: 500, padding: "10px 20px", fontSize: "14px" } }}>
                <TableCell className="text-black border-bottom">Horário</TableCell>
                <TableCell className="text-black border-bottom">Paciente</TableCell>
                <TableCell className="text-black border-bottom">Médico</TableCell>
                <TableCell className="text-black border-bottom">Especialidade</TableCell>
                <TableCell className="text-black border-bottom">Convênio</TableCell>
                <TableCell className="text-black border-bottom">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} align="center" className="border-bottom">Carregando...</TableCell></TableRow>
              )}
              {!loading && agendamentos.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" className="border-bottom">Nenhum agendamento para esta data.</TableCell></TableRow>
              )}
              {agendamentos.map((a) => (
                <TableRow key={a.codAgendamento} sx={{ "& td": { padding: "12px 20px", fontSize: "14px" } }}>
                  <TableCell className="text-black border-bottom">{a.hora}</TableCell>
                  <TableCell className="text-black border-bottom">{a.pacienteNome}</TableCell>
                  <TableCell className="text-black border-bottom" sx={{ fontSize: "13px" }}>{a.profissionalNome}</TableCell>
                  <TableCell className="text-black border-bottom" sx={{ fontSize: "13px" }}>{typeof a.especialidade === 'string' ? a.especialidade : ''}</TableCell>
                  <TableCell className="text-black border-bottom">{a.convenioNome}</TableCell>
                  <TableCell className="border-bottom">
                    <Select
                      size="small"
                      value={a.status}
                      onChange={(e) => changeStatus(a.codAgendamento, Number(e.target.value))}
                      sx={{ fontSize: "13px", borderRadius: "6px" }}
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
