// File path: /styles/left-sidebar-menu.scss

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useParams } from "next/navigation";
import { styled } from "@mui/material/styles";
import ArrowForwardIosSharpIcon from "@mui/icons-material/ArrowForwardIosSharp";
import MuiAccordion, { AccordionProps } from "@mui/material/Accordion";
import MuiAccordionSummary, {
  AccordionSummaryProps,
} from "@mui/material/AccordionSummary";
import MuiAccordionDetails from "@mui/material/AccordionDetails";
import { Box, Typography } from "@mui/material";

// Define the menu data structure
interface MenuItem {
  type: "link" | "accordion" | "sub-title";
  title?: string;
  icon?: string;
  href?: string;
  badge?: { text: string; className?: string };
  subItems?: SubMenuItem[];
  accordionPanel?: string;
}

interface SubMenuItem {
  title: string;
  href: string;
  badge?: { text: string; className?: string };
}

// Styled components remain unchanged
const Accordion = styled((props: AccordionProps) => (
  <MuiAccordion disableGutters elevation={0} square {...props} />
))(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  "&:not(:last-child)": {
    borderBottom: 0,
  },
  "&::before": {
    display: "none",
  },
}));

const AccordionSummary = styled((props: AccordionSummaryProps) => (
  <MuiAccordionSummary
    expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: "0.9rem" }} />}
    {...props}
  />
))(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "#3a4252" : "#f6f7f9",
  flexDirection: "row-reverse",
  "& .MuiAccordionSummary-expandIconWrapper.Mui-expanded": {
    transform: "rotate(90deg)",
  },
  "& .MuiAccordionSummary-content": {
    // marginLeft: theme.spacing(1),
  },
}));

const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
  padding: theme.spacing(2),
  // borderTop: "1px solid rgba(0, 0, 0, .125)",
}));

interface LeftSidebarProps {
  toggleActive: () => void;
  leftSideMenu: any; // or define the type of leftSideMenu if you know it
}

const LeftSidebarMenu: React.FC<LeftSidebarProps> = ({
  toggleActive,
  leftSideMenu,
}) => {
  const { lang } = useParams();
  const pathname = usePathname();
  const [expanded, setExpanded] = React.useState<string | false>("panel1");

  const handleChange =
    (panel: string) => (event: React.SyntheticEvent, newExpanded: boolean) => {
      setExpanded(newExpanded ? panel : false);
    };

  // Dark theme logic remains unchanged
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (pathname === `/${lang}/dashboard/beauty-salon/`) {
      const storedTheme = localStorage.getItem("beautySalonSidebarTheme");
      if (storedTheme) {
        setIsDark(storedTheme === "dark-theme");
      } else {
        setIsDark(true);
        localStorage.setItem("beautySalonSidebarTheme", "dark-theme");
      }
    } else {
      setIsDark(false);
    }
  }, [pathname]);

  return (
    <Box
      className={`leftSidebarDark hide-for-horizontal-nav ${
        pathname === `/${lang}/dashboard/beauty-salon/` && isDark ? "dark-theme" : ""
      }`}
    >
      <Box className="left-sidebar-menu">
        <Box className="logo">
          <Link href={`/${lang}/dashboard/ecommerce/`}>
            <Image
              src="/images/logo-icon.svg"
              alt="logo-icon"
              width={26}
              height={26}
            />
            <Typography component={"span"}>Trezo</Typography>
          </Link>
        </Box>

        <Box className="burger-menu" onClick={toggleActive}>
          <Typography component={"span"} className="top-bar"></Typography>
          <Typography component={"span"} className="middle-bar"></Typography>
          <Typography component={"span"} className="bottom-bar"></Typography>
        </Box>

        <Box className="sidebar-inner">
          <Box className="sidebar-menu">
            {leftSideMenu.map((item: MenuItem, index: number) => {
              if (item.type === "sub-title") {
                return (
                  <Typography
                    key={index}
                    className="sub-title"
                    sx={{
                      display: "block",
                      fontWeight: "500",
                      textTransform: "uppercase",
                    }}
                  >
                    {item.title}
                  </Typography>
                );
              } else if (item.type === "link") {
                return (
                  <Link
                    key={index}
                    href={`/${lang}${item.href!}`}
                    className={`sidebar-menu-link ${
                      pathname === `/${lang}${item.href}` ? "active" : ""
                    }`}
                  >
                    <i className="material-symbols-outlined">{item.icon}</i>
                    <Typography component={"span"} className="title">
                      {item.title}
                    </Typography>
                    {item.badge && (
                      <Typography
                        component={"span"}
                        className={`trezo-badge ${item.badge.className || ""}`}
                      >
                        {item.badge.text}
                      </Typography>
                    )}
                  </Link>
                );
              } else if (item.type === "accordion") {
                return (
                  <Accordion
                    key={index}
                    expanded={expanded === item.accordionPanel}
                    onChange={handleChange(item.accordionPanel!)}
                    className="mat-accordion"
                  >
                    <AccordionSummary
                      className="mat-summary"
                      aria-controls={`${item.accordionPanel}d-content`}
                      id={`${item.accordionPanel}d-header`}
                    >
                      <i className="material-symbols-outlined">{item.icon}</i>
                      <Typography component={"span"} className="title">
                        {item.title}
                      </Typography>
                      {item.badge && (
                        <Typography
                          component={"span"}
                          className={`trezo-badge ${
                            item.badge.className || ""
                          }`}
                        >
                          {item.badge.text}
                        </Typography>
                      )}
                    </AccordionSummary>
                    <AccordionDetails className="mat-details">
                      <ul className="sidebar-sub-menu">
                        {item.subItems?.map((subItem, subIndex) => (
                          <li key={subIndex} className="sidemenu-item">
                            <Link
                              href={`/${lang}${subItem.href}`}
                              className={`sidemenu-link ${
                                pathname === `/${lang}${subItem.href}`
                                  ? "active"
                                  : ""
                              }`}
                            >
                              {subItem.title}
                              {subItem.badge && (
                                <Typography
                                  component={"span"}
                                  className={`trezo-badge ${
                                    subItem.badge.className || ""
                                  }`}
                                >
                                  {subItem.badge.text}
                                </Typography>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </AccordionDetails>
                  </Accordion>
                );
              }
              return null;
            })}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default LeftSidebarMenu;
