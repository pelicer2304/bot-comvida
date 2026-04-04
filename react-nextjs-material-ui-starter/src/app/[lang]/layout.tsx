import "swiper/css";
import "swiper/css/bundle";
import 'remixicon/fonts/remixicon.css';
import 'react-datetime-picker/dist/DateTimePicker.css';
import 'react-calendar/dist/Calendar.css';
import 'react-clock/dist/Clock.css';
import '../../../node_modules/boxicons/css/boxicons.min.css';
import '../../../styles/front-pages.css';
import "../../../styles/control-panel.css";
import "../../../styles/left-sidebar-menu.css";
import "../../../styles/top-navbar.css";
import "../../../styles/crypto-dashboard.css";
import "../../../styles/chat.css";
import "../../../styles/horizontal-navbar.css";
import "../../../styles/globals.css";

// globals dark Mode CSS
import "../../../styles/dark.css";
// globals RTL Mode CSS
import "../../../styles/rtl.css";

import * as React from "react";
import type { ReactNode } from 'react';
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "@/theme";
import { getDictionary } from "./dictionaries";
import LayoutProvider from "@/providers/LayoutProvider";

export const metadata = {
  title: "Trezo - React Nextjs 15+ Material Design Admin Dashboard Template",
  description: "React Nextjs 15+ Material Design Admin Dashboard Template",
};

interface RootLayoutProps {
  children: ReactNode;
  params: Promise<{
    lang: string;
  }>; // Update params to be a Promise
}

export default async function RootLayout({ children, params }: RootLayoutProps) {
  const { lang } = await params; // Await params to get lang
  const dict = await getDictionary(lang);
  
  return (
    <html lang={lang}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
        />
      </head>
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <ThemeProvider theme={theme}>
            {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
            <CssBaseline />

            <LayoutProvider {...dict}>{children}</LayoutProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
