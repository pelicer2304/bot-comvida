"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, Box, Typography, Button, Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip } from "@mui/material";
import { api, PacienteDetail } from "@/lib/api";

const STATUS_LABEL: Record<number, string> = { 0: "Cancelado", 1: "Aguarda", 2: "Confirmado", 3: "Não chegou" };
const STATUS_COLOR: Record<number, "default" | "success" | "warning" | "error"> = { 0: "error", 1: "warning", 2: "success", 3: "default" };

export default function PacienteDetailPage() {
  const { lang, id } = useParams();
  const router = useRouter();
  const [paciente, setPaciente] = useState<PacienteDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPaciente(Number(id)).then(setPaciente).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Box sx={{ p: "25px" }}><Typography>Carregando...</Typography></Box>;
  if (!paciente) return <Box sx={{ p: "25px" }}><Typography>Paciente não encontrado.</Typography></Box>;

  return (
    <Box sx={{ p: { xs: "18px", sm: "25px" } }}>
      <Button variant="text" onClick={() => router.push(`/${lang}/pacientes/`)} sx={{ mb: "16px", textTransform: "none" }}>
        ← Voltar
      </Button>

      {/* Dados cadastrais */}
      <Card sx={{ boxShadow: "none", borderRadius: "7px", p: { xs: "18px", sm: "25px" }, mb: "20px" }} className="rmui-card">
        <Typography variant="h3" sx={{ fontSize: "18px", fontWeight: 700, mb: "20px" }} className="text-black">
          {paciente.nome}
        </Typography>
        <Divider sx={{ mb: "20px" }} />
        {[
          ["CPF", paciente.cpf],
          ["Nascimento", paciente.dataNascimento],
          ["ID ClinicWeb", String(paciente.idPaciente)],
        ].map(([label, value]) => (
          <Box key={label as string} sx={{ display: "flex", gap: "12px", mb: "10px" }}>
            <Typography sx={{ fontSize: "13px", color: "#666", minWidth: "140px" }}>{label}</Typography>
            <Typography sx={{ fontSize: "14px" }} className="text-black">{value as string}</Typography>
          </Box>
        ))}
        {paciente.sessaoAtiva && (
          <Box sx={{ mt: "12px" }}>
            <Chip
              label={`Sessão ativa: ${paciente.sessaoAtiva.step}`}
              color="primary"
              size="small"
              onClick={() => router.push(`/${lang}/sessoes/${encodeURIComponent(paciente.sessaoAtiva!.threadId)}/`)}
              sx={{ cursor: "pointer" }}
            />
          </Box>
        )}
      </Card>

      {/* Convênios */}
      {paciente.convenios?.length > 0 && (
        <Card sx={{ boxShadow: "none", borderRadius: "7px", p: { xs: "18px", sm: "25px" }, mb: "20px" }} className="rmui-card">
          <Typography variant="h4" sx={{ fontSize: "15px", fontWeight: 600, mb: "16px" }} className="text-black">
            Convênios
          </Typography>
          <Box sx={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {paciente.convenios.map((c) => (
              <Chip key={c.codConvenio} label={c.descricaoConvenio} size="small" variant="outlined" />
            ))}
          </Box>
        </Card>
      )}

      {/* Histórico de agendamentos */}
      <Card sx={{ boxShadow: "none", borderRadius: "7px", p: { xs: "18px", sm: "25px" } }} className="rmui-card">
        <Typography variant="h4" sx={{ fontSize: "15px", fontWeight: 600, mb: "16px" }} className="text-black">
          Histórico de Agendamentos
        </Typography>
        {!paciente.agendamentos?.length ? (
          <Typography sx={{ fontSize: "13px", color: "#666" }}>Nenhum agendamento encontrado.</Typography>
        ) : (
          <TableContainer component={Paper} sx={{ boxShadow: "none" }} className="rmui-table border">
            <Table sx={{ minWidth: 500 }}>
              <TableHead className="bg-f6f7f9">
                <TableRow sx={{ "& th": { fontWeight: 500, padding: "10px 16px", fontSize: "13px" } }}>
                  <TableCell className="text-black border-bottom">Data</TableCell>
                  <TableCell className="text-black border-bottom">Horário</TableCell>
                  <TableCell className="text-black border-bottom">Convênio</TableCell>
                  <TableCell className="text-black border-bottom">Status</TableCell>
                  <TableCell className="text-black border-bottom">Bot</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paciente.agendamentos.map((a) => (
                  <TableRow key={a.codAgendamento} sx={{ "& td": { padding: "10px 16px", fontSize: "13px" } }}>
                    <TableCell className="border-bottom">{a.data}</TableCell>
                    <TableCell className="border-bottom">{a.hora}</TableCell>
                    <TableCell className="border-bottom">{a.convenioNome}</TableCell>
                    <TableCell className="border-bottom">
                      <Chip label={STATUS_LABEL[a.status] ?? a.statusDescricao} color={STATUS_COLOR[a.status] ?? "default"} size="small" />
                    </TableCell>
                    <TableCell className="border-bottom">
                      {a.criadoPeloBot && <span className="trezo-badge Confirmed">BOT</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </Box>
  );
}
