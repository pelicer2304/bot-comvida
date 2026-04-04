"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TableFooter, TablePagination, IconButton } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import { api, SessionSummary } from "@/lib/api";

const STEP_BADGE: Record<string, string> = {
  identificacao: "Pending",
  convenio: "Shipped",
  especialidade: "Shipped",
  horarios: "Shipped",
  confirmacao: "Confirmed",
  concluido: "Confirmed",
  escalado: "Rejected",
  resetado: "Pending",
};

const STEP_LABEL: Record<string, string> = {
  identificacao: "Identificando",
  convenio: "Convênio",
  especialidade: "Especialidade",
  horarios: "Horários",
  confirmacao: "Confirmação",
  concluido: "Concluído",
  escalado: "Escalado",
  resetado: "Reiniciado",
};

function PaginationActions({ count, page, rowsPerPage, onPageChange }: { count: number; page: number; rowsPerPage: number; onPageChange: (e: React.MouseEvent<HTMLButtonElement> | null, p: number) => void }) {
  const theme = useTheme();
  return (
    <Box sx={{ flexShrink: 0, display: "flex", gap: "10px", padding: "14px 20px" }}>
      <IconButton onClick={(e) => onPageChange(e, page - 1)} disabled={page === 0} sx={{ borderRadius: "4px", padding: "6px" }} className="border">
        {theme.direction === "rtl" ? <KeyboardArrowRight /> : <KeyboardArrowLeft />}
      </IconButton>
      <IconButton onClick={(e) => onPageChange(e, page + 1)} disabled={page >= Math.ceil(count / rowsPerPage) - 1} sx={{ borderRadius: "4px", padding: "6px" }} className="border">
        {theme.direction === "rtl" ? <KeyboardArrowLeft /> : <KeyboardArrowRight />}
      </IconButton>
    </Box>
  );
}

export default function SessoesPage() {
  const { lang } = useParams();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;

  useEffect(() => {
    api.getSessions().then(setSessions).catch(() => {});
    const t = setInterval(() => api.getSessions().then(setSessions).catch(() => {}), 15000);
    return () => clearInterval(t);
  }, []);

  const filtered = sessions.filter((s) =>
    (s.pacienteNome ?? s.threadId).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ p: { xs: "18px", sm: "25px" } }}>
      <Card sx={{ boxShadow: "none", borderRadius: "7px", p: { xs: "18px", sm: "25px" } }} className="rmui-card">
        <Box sx={{ display: { xs: "block", sm: "flex" }, alignItems: "center", justifyContent: "space-between", mb: "25px" }}>
          <Typography variant="h3" sx={{ fontSize: "18px", fontWeight: 700 }} className="text-black">
            Sessões Ativas
          </Typography>
          <form className="t-search-form">
            <label><i className="material-symbols-outlined">search</i></label>
            <input type="text" className="t-input" placeholder="Buscar paciente..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          </form>
        </Box>

        <TableContainer component={Paper} sx={{ boxShadow: "none", borderRadius: "7px" }} className="rmui-table border">
          <Table sx={{ minWidth: 650 }}>
            <TableHead className="bg-f6f7f9">
              <TableRow sx={{ "& th": { fontWeight: 500, padding: "10px 20px", fontSize: "14px" } }}>
                <TableCell className="text-black border-bottom">Thread</TableCell>
                <TableCell className="text-black border-bottom">Paciente</TableCell>
                <TableCell className="text-black border-bottom">Última atividade</TableCell>
                <TableCell className="text-black border-bottom">Tentativas</TableCell>
                <TableCell className="text-black border-bottom">Step</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((s) => (
                <TableRow key={s.threadId} sx={{ "& td": { padding: "14px 20px", fontSize: "14px" } }}>
                  <TableCell className="text-black border-bottom">
                    <Link href={`/${lang}/sessoes/${encodeURIComponent(s.threadId)}/`} className="text-primary">
                      {s.threadId.slice(0, 20)}…
                    </Link>
                  </TableCell>
                  <TableCell className="text-black border-bottom">{s.pacienteNome ?? "—"}</TableCell>
                  <TableCell className="text-black border-bottom">
                    {new Date(s.lastActivityAt).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-black border-bottom">{s.tentativasTotal}</TableCell>
                  <TableCell className="border-bottom">
                    <div className={`trezo-badge ${STEP_BADGE[s.step] ?? "Pending"}`}>
                      {STEP_LABEL[s.step] ?? s.step}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[10]}
                  colSpan={5}
                  count={filtered.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={(_, p) => setPage(p)}
                  ActionsComponent={PaginationActions}
                  sx={{ border: "none" }}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
