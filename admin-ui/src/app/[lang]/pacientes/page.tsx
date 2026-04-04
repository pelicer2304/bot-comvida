"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip } from "@mui/material";
import { api, Paciente } from "@/lib/api";

export default function PacientesPage() {
  const { lang } = useParams();
  const [query, setQuery] = useState("");
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.length < 3) return;
    setLoading(true);
    api.getPacientes(query).then((r) => { setPacientes(Array.isArray(r) ? r : []); setSearched(true); }).catch(() => setPacientes([])).finally(() => setLoading(false));
  }

  return (
    <Box sx={{ p: { xs: "18px", sm: "25px" } }}>
      <Card sx={{ boxShadow: "none", borderRadius: "7px", p: { xs: "18px", sm: "25px" } }} className="rmui-card">
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "25px", flexWrap: "wrap", gap: "12px" }}>
          <Typography variant="h3" sx={{ fontSize: "18px", fontWeight: 700 }} className="text-black">
            Pacientes
          </Typography>
          <form className="t-search-form" onSubmit={handleSearch}>
            <label><i className="material-symbols-outlined">search</i></label>
            <input type="text" className="t-input" placeholder="Nome ou CPF (mín 3 chars)..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </form>
        </Box>

        {!searched && <Typography sx={{ color: "#666", fontSize: "14px" }}>Digite um nome ou CPF para buscar.</Typography>}
        {loading && <Typography sx={{ color: "#666", fontSize: "14px" }}>Buscando...</Typography>}

        {searched && !loading && (
          <TableContainer component={Paper} sx={{ boxShadow: "none", borderRadius: "7px" }} className="rmui-table border">
            <Table sx={{ minWidth: 650 }}>
              <TableHead className="bg-f6f7f9">
                <TableRow sx={{ "& th": { fontWeight: 500, padding: "10px 20px", fontSize: "14px" } }}>
                  <TableCell className="text-black border-bottom">Nome</TableCell>
                  <TableCell className="text-black border-bottom">CPF</TableCell>
                  <TableCell className="text-black border-bottom">Nascimento</TableCell>
                  <TableCell className="text-black border-bottom">Bot</TableCell>
                  <TableCell className="text-black border-bottom">Ação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pacientes.length === 0 && (
                  <TableRow><TableCell colSpan={5} align="center" className="border-bottom">Nenhum paciente encontrado.</TableCell></TableRow>
                )}
                {pacientes.map((p) => (
                  <TableRow key={p.idPaciente} sx={{ "& td": { padding: "12px 20px", fontSize: "14px" } }}>
                    <TableCell className="text-black border-bottom">{p.nome}</TableCell>
                    <TableCell className="text-black border-bottom">{p.cpf}</TableCell>
                    <TableCell className="text-black border-bottom">{p.dataNascimento}</TableCell>
                    <TableCell className="border-bottom">
                      {p.sessaoAtiva && <Chip label={`Em conversa: ${p.sessaoAtiva.step}`} size="small" color="primary" />}
                    </TableCell>
                    <TableCell className="border-bottom">
                      <Link href={`/${lang}/pacientes/${p.idPaciente}/`} className="text-primary" style={{ fontSize: "13px" }}>
                        Ver detalhes
                      </Link>
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
