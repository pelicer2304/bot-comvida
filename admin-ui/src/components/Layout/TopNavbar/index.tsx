"use client";

import React, { useEffect } from "react";
import { AppBar, Toolbar, IconButton, Box, Typography } from "@mui/material";
import Link from "next/link";
import Tooltip from "@mui/material/Tooltip";
import Notifications from "./Notifications";
import Profile from "./Profile";
import DarkMode from "./DarkMode";

interface TopNavbarProps {
  toggleActive: () => void;
  topHeaderNavbar: any;
}

const TopNavbar: React.FC<TopNavbarProps> = ({ toggleActive, topHeaderNavbar }) => {
  useEffect(() => {
    const elementId = document.getElementById("navbar");
    document.addEventListener("scroll", () => {
      if (window.scrollY > 100) elementId?.classList.add("sticky");
      else elementId?.classList.remove("sticky");
    });
  });

  return (
    <div className="top-navbar-dark">
      <AppBar
        id="navbar"
        color="inherit"
        sx={{ backgroundColor: "#fff", boxShadow: "initial", borderRadius: "0 0 15px 15px", py: { xs: "15px", sm: "3px" }, px: "0 !important", width: "initial", zIndex: "489" }}
        className="top-navbar"
      >
        <Box className="top-navbar-content">
          <Toolbar sx={{ display: { xs: "block", sm: "flex" }, justifyContent: { xs: "center", sm: "space-between" } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: { xs: "10px", md: "15px" } }}>
              <Link href="/pt/dashboard/" className="logo">
                <Typography sx={{ fontWeight: 700, fontSize: "16px", color: "primary.main" }}>
                </Typography>
              </Link>
              <Tooltip title="Ocultar/Mostrar menu" arrow>
                <IconButton size="small" edge="start" color="inherit" onClick={toggleActive} className="top-burger">
                  <i className="material-symbols-outlined">menu</i>
                </IconButton>
              </Tooltip>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: { xs: "8px", lg: "15px" }, mt: { xs: "10px", sm: "0px" } }}>
              <DarkMode />
              <Notifications topHeaderNavbar={topHeaderNavbar} />
              <Profile />
            </Box>
          </Toolbar>
        </Box>
      </AppBar>
    </div>
  );
};

export default TopNavbar;
