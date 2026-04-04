"use client";

import * as React from "react";
import {
  IconButton,
  Typography,
  Box,
  Tooltip,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
} from "@mui/material";
import Link from "next/link";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import ChatIcon from "@mui/icons-material/Chat";
import ListIcon from "@mui/icons-material/List";
import Logout from "@mui/icons-material/Logout";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import SettingsIcon from "@mui/icons-material/Settings";
import SupportIcon from "@mui/icons-material/Support";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import { usePathname, useParams } from "next/navigation";

const Profile: React.FC<{}> = () => {
  const pathname = usePathname();
  const { lang } = useParams();

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
      <Tooltip title="Account settings">
        <IconButton
          onClick={handleClick}
          size="small"
          sx={{ p: 0, borderRadius: "5px" }}
          aria-controls={open ? "account-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={open ? "true" : undefined}
        >
          <Avatar
            src="/images/admin.png"
            alt="Olivia"
            sx={{
              width: { xs: "35px", sm: "42px" },
              height: { xs: "35px", sm: "42px" },
              border: "2px solid #C2CDFF",
            }}
            className="mr-8"
          />
          <Typography
            variant="h3"
            sx={{
              fontWeight: "600",
              fontSize: "13px",
              display: { xs: "none", sm: "block" },
            }}
            className="text-black"
          >
            {lang === "en" ? "Olivia" : lang === "fr" ? "Olive" : "أوليفيا"}
          </Typography>
          <KeyboardArrowDownIcon sx={{ fontSize: "15px" }} />
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
        className="for-dark-top-navList"
      >
        <MenuItem sx={{ padding: "10px 20px" }}>
          <Avatar
            src="/images/admin.png"
            sx={{
              width: 31,
              height: 31,
              border: "2px solid #C2CDFF",
            }}
            className="mr-8"
          />
          <Box>
            <Typography
              variant="h5"
              sx={{
                fontSize: "13px",
                color: "#260944",
                fontWeight: "500",
              }}
              className="text-black"
            >
              {lang === "en" ? "Olivia" : lang === "fr" ? "Olive" : "أوليفيا"}
            </Typography>

            <Typography sx={{ fontSize: "12px" }}>
              {lang === "en"
                ? "Marketing Manager"
                : lang === "fr"
                ? "Responsable marketing"
                : "مدير التسويق"}
            </Typography>
          </Box>
        </MenuItem>

        <Divider sx={{ borderColor: "#F6F7F9" }} />

        <MenuItem sx={{ padding: "8px 20px" }}>
          <Link
            href={`/${lang}/my-profile/`}
            className={`text-black ${
              pathname === `/${lang}/my-profile/` ? `text-primary` : ""
            }`}
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
            }}
          >
            <ListItemIcon sx={{ mr: "-10px", mt: "-3px" }}>
              <AccountCircleIcon
                sx={{ fontSize: "20px" }}
                className="text-black"
              />
            </ListItemIcon>

            <span style={{ fontSize: "13px" }}>
              {lang === "en"
                ? "My Profile"
                : lang === "fr"
                ? "Mon profil"
                : "ملفي الشخصي"}
            </span>
          </Link>
        </MenuItem>

        <MenuItem sx={{ padding: "8px 20px" }}>
          <Link
            href={`/${lang}/apps/chat/`}
            className={`text-black ${
              pathname === `/${lang}/apps/chat/` ? `text-primary` : ""
            }`}
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
            }}
          >
            <ListItemIcon sx={{ mr: "-10px", mt: "-3px" }}>
              <ChatIcon sx={{ fontSize: "20px" }} className="text-black" />
            </ListItemIcon>

            <span style={{ fontSize: "13px" }}>
              {lang === "en"
                ? "Messages"
                : lang === "fr"
                ? "Messages"
                : "رسائل"}
            </span>
          </Link>
        </MenuItem>

        <MenuItem sx={{ padding: "8px 20px" }}>
          <Link
            href={`/${lang}/apps/to-do-list/`}
            className={`text-black ${
              pathname === `/${lang}/apps/to-do-list/` ? `text-primary` : ""
            }`}
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
            }}
          >
            <ListItemIcon sx={{ mr: "-10px", mt: "-3px" }}>
              <ListIcon sx={{ fontSize: "20px" }} className="text-black" />
            </ListItemIcon>

            <span style={{ fontSize: "13px" }}>
              {lang === "en" ? "My Task" : lang === "fr" ? "Ma tâche" : "مهمتي"}
            </span>
          </Link>
        </MenuItem>

        <MenuItem sx={{ padding: "8px 20px" }}>
          <Link
            href={`/${lang}/ecommerce/checkout/`}
            className={`text-black ${
              pathname === `/${lang}/ecommerce/checkout/` ? `text-primary` : ""
            }`}
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
            }}
          >
            <ListItemIcon sx={{ mr: "-10px", mt: "-3px" }}>
              <CreditCardIcon
                sx={{ fontSize: "20px" }}
                className="text-black"
              />
            </ListItemIcon>

            <span style={{ fontSize: "13px" }}>
              {lang === "en"
                ? "Billing"
                : lang === "fr"
                ? "Facturation"
                : "الفواتير"}
            </span>
          </Link>
        </MenuItem>

        <Divider sx={{ borderColor: "#F6F7F9" }} />

        <MenuItem sx={{ padding: "8px 20px" }}>
          <Link
            href={`/${lang}/settings/`}
            className={`text-black ${
              pathname === `/${lang}/settings/` ? `text-primary` : ""
            }`}
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
            }}
          >
            <ListItemIcon sx={{ mr: "-10px", mt: "-3px" }}>
              <SettingsIcon sx={{ fontSize: "20px" }} className="text-black" />
            </ListItemIcon>

            <span style={{ fontSize: "13px" }}>
              {lang === "en"
                ? "Settings"
                : lang === "fr"
                ? "Paramètres"
                : "إعدادات"}
            </span>
          </Link>
        </MenuItem>

        <MenuItem sx={{ padding: "8px 20px" }}>
          <Link
            href={`/${lang}/faq/`}
            className={`text-black ${
              pathname === `/${lang}/faq/` ? `text-primary` : ""
            }`}
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
            }}
          >
            <ListItemIcon sx={{ mr: "-10px", mt: "-3px" }}>
              <SupportIcon sx={{ fontSize: "20px" }} className="text-black" />
            </ListItemIcon>

            <span style={{ fontSize: "13px" }}>
              {lang === "en" ? "Support" : lang === "fr" ? "Soutien" : "يدعم"}
            </span>
          </Link>
        </MenuItem>

        <MenuItem sx={{ padding: "8px 20px" }}>
          <Link
            href={`/${lang}/authentication/lock-screen/`}
            className="text-black"
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
            }}
          >
            <ListItemIcon sx={{ mr: "-10px", mt: "-3px" }}>
              <LockOpenIcon sx={{ fontSize: "20px" }} className="text-black" />
            </ListItemIcon>

            <span style={{ fontSize: "13px" }}>
              {lang === "en"
                ? "Lock Screen"
                : lang === "fr"
                ? "Écran de verrouillage"
                : "شاشة القفل"}
            </span>
          </Link>
        </MenuItem>

        <MenuItem sx={{ padding: "8px 20px" }}>
          <Link
            href={`/${lang}/authentication/logout/`}
            className="text-black"
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
            }}
          >
            <ListItemIcon sx={{ mr: "-10px", mt: "-3px" }}>
              <Logout sx={{ fontSize: "20px" }} className="text-black" />
            </ListItemIcon>

            <span style={{ fontSize: "13px" }}>
              {lang === "en"
                ? "Logout"
                : lang === "fr"
                ? "Déconnexion"
                : "تسجيل الخروج"}
            </span>
          </Link>
        </MenuItem>
      </Menu>
    </>
  );
};

export default Profile;
