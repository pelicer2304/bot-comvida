"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button } from "@mui/material";
import { api, Convenio } from "@/lib/api";

export default function ConveniosPage() {
  const { lang } = useParams();
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { api.getConvenios().then(setConvenios).catch(() => {}); }, []);

  async function handleSync() {
    setSyncing(true);
    await api.syncConvenios().catch(() => {});
    await api.getConvenios().then(setConvenios).catch(() => {});
    setSyncing(false);
  }

  const filtered = convenios.filter((c) =>
    c.descricaoConvenio.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ p: { xs: "18px", sm: "25px" } }}>
      <Card sx={{ boxShadow: "none", borderRadius: "7px", p: { xs: "18px", sm: "25px" } }} className="rmui-card">
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "25px", flexWrap: "wrap", gap: "12px" }}>
          <Typography variant="h3" sx={{ fontSize: "18px", fontWeight: 700 }} className="text-black">
            Convênios ({convenios.length})
          </Typography>
          <Box sx={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <form className="t-search-form">
              <label><i className="material-symbols-outlined">search</i></label>
              <input type="text" className="t-input" placeholder="Buscar convênio..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </form>
            <Button variant="outlined" size="small" disabled={syncing} onClick={handleSync}>
              {syncing ? "Sincronizando..." : "Sincronizar"}
            </Button>
          </Box>
        </Box>

        <TableContainer component={Paper} sx={{ boxShadow: "none", borderRadius: "7px" }} className="rmui-table border">
          <Table sx={{ minWidth: 650 }}>
            <TableHead className="bg-f6f7f9">
              <TableRow sx={{ "& th": { fontWeight: 500, padding: "10px 20px", fontSize: "14px" } }}>
                <TableCell className="text-black border-bottom">Convênio</TableCell>
                <TableCell className="text-black border-bottom">Código ANS</TableCell>
                <TableCell className="text-black border-bottom">Planos</TableCell>
                <TableCell className="text-black border-bottom">Observação</TableCell>
                <TableCell className="text-black border-bottom">Ação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.codConvenio} sx={{ "& td": { padding: "12px 20px", fontSize: "14px" } }}>
                  <TableCell className="text-black border-bottom">{c.descricaoConvenio}</TableCell>
                  <TableCell className="text-black border-bottom">{c.codANS}</TableCell>
                  <TableCell className="text-black border-bottom">{c.planos?.length ?? 0}</TableCell>
                  <TableCell className="border-bottom" sx={{ maxWidth: "300px" }}>
                    <Typography sx={{ fontSize: "12px", color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.observacao ? c.observacao.slice(0, 80) + "…" : "—"}
                    </Typography>
                  </TableCell>
                  <TableCell className="border-bottom">
                    <Link href={`/${lang}/convenios/${c.codConvenio}/`} className="text-primary" style={{ fontSize: "13px" }}>
                      Editar
                    </Link>
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
