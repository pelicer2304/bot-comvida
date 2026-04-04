"use client";

import * as React from "react";
import { Card, Box, Typography } from "@mui/material";
import Link from "next/link";
import SearchForm from "./SearchForm";
import { usePathname, useParams } from "next/navigation";
import styles from "@/components/Apps/FileManager/Sidebar/Sidebar.module.css";

const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { lang } = useParams();

  return (
    <>
      <Card
        className="email-sidebar-card"
        sx={{
          boxShadow: "none",
          bgcolor: "#fff",
          mb: "25px",
          borderRadius: "7px",
          position: "relative",
        }}
      >
        <Box sx={{ padding: { xs: "20px", sm: "25px" } }}>
          <Box sx={{ mb: "20px" }}>
            <SearchForm />
          </Box>

          <ul className={styles.sidebarMenu}>
            <li>
              <Link
                href={`/${lang}/apps/file-manager/`}
                className={`link ${
                  pathname === `/${lang}/apps/file-manager/`
                    ? `${styles.active}`
                    : ""
                }`}
              >
                <i className="material-symbols-outlined">drive_eta</i>
                My Drive
                <span className="text-body">6</span>
              </Link>

              <ul className="list-unstyled">
                <li>
                  <Link
                    href={`/${lang}/apps/file-manager/assets/`}
                    className={`link ${
                      pathname === `/${lang}/apps/file-manager/assets/`
                        ? `${styles.active}`
                        : ""
                    }`}
                  >
                    Assets
                  </Link>
                </li>

                <li>
                  <Link
                    href={`/${lang}/apps/file-manager/projects/`}
                    className={`link ${
                      pathname === `/${lang}/apps/file-manager/projects/`
                        ? `${styles.active}`
                        : ""
                    }`}
                  >
                    Projects
                  </Link>
                </li>

                <li>
                  <Link
                    href={`/${lang}/apps/file-manager/personal/`}
                    className={`link ${
                      pathname === `/${lang}/apps/file-manager/personal/`
                        ? `${styles.active}`
                        : ""
                    }`}
                  >
                    Personal
                  </Link>
                </li>

                <li>
                  <Link
                    href={`/${lang}/apps/file-manager/applications/`}
                    className={`link ${
                      pathname === `/${lang}/apps/file-manager/applications/`
                        ? `${styles.active}`
                        : ""
                    }`}
                  >
                    Applications
                  </Link>
                </li>
              </ul>
            </li>

            <li>
              <Link
                href={`/${lang}/apps/file-manager/documents/`}
                className={`link ${
                  pathname === `/${lang}/apps/file-manager/documents/`
                    ? `${styles.active}`
                    : ""
                }`}
              >
                <i className="material-symbols-outlined text-success">
                  description
                </i>
                Documents
              </Link>
            </li>

            <li>
              <Link
                href={`/${lang}/apps/file-manager/media/`}
                className={`link ${
                  pathname === `/${lang}/apps/file-manager/media/`
                    ? `${styles.active}`
                    : ""
                }`}
              >
                <i className="material-symbols-outlined text-info">
                  perm_media
                </i>
                Media
              </Link>
            </li>

            <li>
              <Link
                href={`/${lang}/apps/file-manager/recents/`}
                className={`link ${
                  pathname === `/${lang}/apps/file-manager/recents/`
                    ? `${styles.active}`
                    : ""
                }`}
              >
                <i className="material-symbols-outlined text-purple">
                  schedule
                </i>
                Recents
              </Link>
            </li>

            <li>
              <Link
                href={`/${lang}/apps/file-manager/important/`}
                className={`link ${
                  pathname === `/${lang}/apps/file-manager/important/`
                    ? `${styles.active}`
                    : ""
                }`}
              >
                <i className="material-symbols-outlined text-warning">grade</i>
                Important
              </Link>
            </li>

            <li>
              <Link href="#">
                <i className="material-symbols-outlined text-primary">
                  report_gmailerrorred
                </i>
                Spam
                <span className="text-body">10</span>
              </Link>
            </li>

            <li>
              <Link href="#">
                <i className="material-symbols-outlined text-danger">delete</i>
                Trash
                <span className="d-block text-body">15</span>
              </Link>
            </li>
          </ul>
        </Box>

        <Box
          className="border-top"
          sx={{
            padding: { xs: "20px", sm: "25px" },
          }}
        >
          <Typography
            variant="h5"
            fontWeight={700}
            fontSize="15px"
            mb="10px"
            className="text-black"
          >
            Storage Status
          </Typography>

          <Typography mb="10px">% 50 GB used of 100 GB</Typography>

          <Box
            sx={{
              bgcolor: "#ecf0ff",
              width: "100%",
              height: "4px",
            }}
          >
            <Box
              sx={{
                bgcolor: "primary.main",
                width: "50%",
                height: "4px",
              }}
            ></Box>
          </Box>
        </Box>
      </Card>
    </>
  );
};

export default Sidebar;
