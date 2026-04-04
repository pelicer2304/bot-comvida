"use client";

import * as React from "react";
import styles from "@/components/Layout/TopNavbar/ChooseLanguage/ChooseLanguage.module.css";
import { Typography, IconButton, Button, Tooltip, Menu } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import TranslateIcon from "@mui/icons-material/Translate";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

const ChooseLanguage: React.FC = () => {
  const { lang } = useParams();
  const pathname = usePathname();
  // const router = useRouter();

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  // Function to generate the new path with the selected language
  const getLocalizedPath = (newLang: string) => {
    // Remove current language prefix if exists
    const pathWithoutLang = pathname.replace(/^\/(en|ar|fr)/, '');
    // Add new language prefix
    return `/${newLang}${pathWithoutLang || '/dashboard/ecommerce'}`;
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
          <TranslateIcon />
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
            width: "240px",
            padding: "0",
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
        <Typography
          variant="h4"
          sx={{
            fontSize: "15px",
            padding: "10px 20px 15px",
            fontWeight: "600",
          }}
          className="text-black"
        >
          {lang === "en"
            ? "Choose Language"
            : lang === "fr"
            ? "Choisir la langue"
            : "اختر اللغة"}
        </Typography>

        <ul className={styles.langList}>
          <li>
            <Link
              href={getLocalizedPath("en")}
              className={` ${
                lang === "en" ? `bg-gray` : ""
              }`}
              style={{
                display: "block",
              }}
            >
              <Button variant="text" className="text-black">
                <Image
                  src="/images/flags/usa.svg"
                  alt="usa"
                  width={30}
                  height={30}
                />
                English
              </Button>
            </Link>
          </li>

          <li>
            <Link
              href={getLocalizedPath("ar")}
              className={` ${
                lang === "ar" ? `bg-gray` : ""
              }`}
              style={{
                display: "block",
              }}
            >
              <Button variant="text" className="text-black">
                <Image
                  src="/images/flags/arabic.svg"
                  alt="canada"
                  width={30}
                  height={30}
                />
                Arabic
              </Button>
            </Link>
          </li>

          <li>
            <Link
              href={getLocalizedPath("fr")}
              className={` ${
                lang === "fr" ? `bg-gray` : ""
              }`}
              style={{
                display: "block",
              }}
            >
              <Button variant="text" className="text-black">
                <Image
                  src="/images/flags/france.svg"
                  alt="germany"
                  width={30}
                  height={30}
                />
                France
              </Button>
            </Link>
          </li>
        </ul>
      </Menu>
    </>
  );
};

export default ChooseLanguage;