"use client";

import * as React from "react";
import styles from "@/components/Layout/TopNavbar/AppsMenu/AppsMenu.module.css";
import { IconButton, Typography, Tooltip, Menu } from "@mui/material";
import Image from "next/image";

interface AppsMenuProps {
  topHeaderNavbar: any; // or define the type of topHeaderNavbar if you know it
}

const AppsMenu: React.FC<AppsMenuProps> = ({ topHeaderNavbar }) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title="Apps">
        <IconButton
          onClick={handleClick}
          size="small"
          aria-controls={open ? "account-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={open ? "true" : undefined}
          className="for-dark-notification"
        >
          <i className="material-symbols-outlined">apps</i>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        id="account-menu"
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        PaperProps={{
          elevation: 0,
          sx: {
            maxWidth: "240px",
            padding: "20px 15px 0",
            borderRadius: "7px",
            boxShadow: "0 4px 45px #0000001a",
            overflow: "visible",
            mt: 1.5,
            "& .MuiAvatar-root": {
              width: 32,
              height: 32,
              ml: -0.5,
              mr: 1,
            },
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
        <ul className={styles.appsMenuList}>
          {topHeaderNavbar.topMenuApps.map((app: any) => (
            <li key={app.name}>
              <a href={app.url} target="_blank" rel="noopener noreferrer">
                <Image
                  src={app.icon}
                  alt={app.name.toLowerCase()}
                  width={30}
                  height={30}
                  className="h-30"
                />
                <Typography sx={{ display: "block", fontSize: "12px" }}>
                  {app.name}
                </Typography>
              </a>
            </li>
          ))}
        </ul>
      </Menu>
    </>
  );
};

export default AppsMenu;
