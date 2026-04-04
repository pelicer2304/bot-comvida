"use client";

import * as React from "react";
import styles from "@/components/Layout/TopNavbar/Notifications/Notifications.module.css";
import { IconButton, Typography, Tooltip, Menu, Badge, Box } from "@mui/material";
import Link from "next/link";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import { useParams } from "next/navigation";
import { api, SessionSummary } from "@/lib/api";
import { useEscaladasCount } from "@/providers/EscaladasProvider";

const Notifications: React.FC<{ topHeaderNavbar: any }> = ({ topHeaderNavbar }) => {
  const { lang } = useParams();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [escaladas, setEscaladas] = React.useState<SessionSummary[]>([]);
  const count = useEscaladasCount();

  // Fetch full list only when menu opens
  function handleOpen(e: React.MouseEvent<HTMLElement>) {
    setAnchorEl(e.currentTarget);
    api.getEscaladas().then(setEscaladas).catch(() => {});
  }

  return (
    <>
      <Tooltip title="Notificações">
        <IconButton
          onClick={handleOpen}
          size="small"
          sx={{ width: "35px", height: "35px", p: 0 }}
          aria-controls={anchorEl ? "notif-menu" : undefined}
          aria-haspopup="true"
          className="for-dark-notification"
        >
          <Badge badgeContent={count || undefined} color="error">
            <NotificationsNoneIcon color="action" sx={{ fontSize: "24px" }} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        id="notif-menu"
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        onClick={() => setAnchorEl(null)}
        PaperProps={{
          elevation: 0,
          sx: {
            padding: "0",
            borderRadius: "7px",
            boxShadow: "0 4px 45px #0000001a",
            overflow: "visible",
            mt: 1.5,
            minWidth: "300px",
            "&:before": {
              content: '""',
              display: "block",
              position: "absolute",
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: "background.paper",
              transform: "translateY(-50%) rotate(45deg)",
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <div className={styles.header}>
          <Typography variant="h4">
            Escalamentos <span className="text-body">({escaladas.length})</span>
          </Typography>
        </div>

        <div className={styles.notification}>
          {escaladas.length === 0 ? (
            <Typography textAlign="center" sx={{ pt: 2, pb: 2, fontSize: "12px" }}>
              Nenhum escalamento pendente
            </Typography>
          ) : (
            escaladas.map((s) => (
              <div key={s.threadId} className={styles.notificationList} style={{ position: "relative" }}>
                <div className={styles.icon}>
                  <i className="material-symbols-outlined" style={{ color: "#ee368c" }}>warning</i>
                </div>
                <Box component="span" sx={{ display: "block", mb: "4px", fontSize: "13px" }} className="text-black">
                  {s.pacienteNome ?? s.threadId.slice(0, 12) + "…"}
                </Box>
                <Box component="span" sx={{ display: "block", fontSize: "11px", color: "#666" }}>
                  {new Date(s.lastActivityAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </Box>
                <Link
                  href={`/${lang}/sessoes/${encodeURIComponent(s.threadId)}/`}
                  style={{ display: "block", position: "absolute", inset: 0, zIndex: 1 }}
                />
              </div>
            ))
          )}
        </div>
      </Menu>
    </>
  );
};

export default Notifications;
