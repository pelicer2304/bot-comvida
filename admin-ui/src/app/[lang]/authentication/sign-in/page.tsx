"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { Box, Button, FormControl, TextField, Typography, Alert } from "@mui/material";
import { api } from "@/lib/api";

export default function SignInPage() {
  const { lang } = useParams();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { token } = await api.login(username, password);
      localStorage.setItem("admin_token", token);
      router.push(`/${lang}/dashboard/`);
    } catch (e) {
      setError(`Erro: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box className="auth-main-wrapper sign-in-area" sx={{ py: { xs: "60px", md: "120px" } }}>
      <Box sx={{ maxWidth: "420px", mx: "auto", px: "24px" }}>
        <Typography variant="h1" sx={{ fontSize: "24px", fontWeight: 700, mb: "8px" }} className="text-black">
          Clínica ComVida
        </Typography>
        <Typography sx={{ mb: "32px", color: "#666" }}>Painel Administrativo</Typography>

        {error && <Alert severity="error" sx={{ mb: "16px" }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit}>
          <FormControl fullWidth sx={{ mb: "16px" }}>
            <Typography component="label" sx={{ fontWeight: 500, fontSize: "14px", mb: "8px", display: "block" }} className="text-black">
              Usuário
            </Typography>
            <TextField
              variant="filled"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              sx={{ "& .MuiInputBase-root": { border: "1px solid #D5D9E2", backgroundColor: "#fff", borderRadius: "7px" }, "& .MuiInputBase-root::before": { border: "none" }, "& .MuiInputBase-root:hover::before": { border: "none" } }}
            />
          </FormControl>

          <FormControl fullWidth sx={{ mb: "24px" }}>
            <Typography component="label" sx={{ fontWeight: 500, fontSize: "14px", mb: "8px", display: "block" }} className="text-black">
              Senha
            </Typography>
            <TextField
              variant="filled"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              sx={{ "& .MuiInputBase-root": { border: "1px solid #D5D9E2", backgroundColor: "#fff", borderRadius: "7px" }, "& .MuiInputBase-root::before": { border: "none" }, "& .MuiInputBase-root:hover::before": { border: "none" } }}
            />
          </FormControl>

          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            fullWidth
            sx={{ textTransform: "capitalize", borderRadius: "6px", fontWeight: 500, fontSize: "16px", padding: "12px", color: "#fff !important", boxShadow: "none" }}
          >
            <i className="material-symbols-outlined mr-5">login</i>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
