"use client";

import React, { useState, ReactNode } from "react";
import { usePathname, useParams } from "next/navigation";
import LeftSidebarMenu from "@/components/Layout/LeftSidebarMenu";
import TopNavbar from "./../components/Layout/TopNavbar/index";
import Footer from "@/components/Layout/Footer";
import ControlPanel from "@/components/Layout/ControlPanel";

interface LayoutProviderProps {
  children: ReactNode;
  leftSideMenu?: any;
  topHeaderNavbar?: any;
}

const LayoutProvider: React.FC<LayoutProviderProps> = ({
  children,
  leftSideMenu,
  topHeaderNavbar,
}) => {
  const { lang } = useParams();

  const [active, setActive] = useState<boolean>(false);
  const pathname = usePathname();

  const toggleActive = () => {
    setActive(!active);
  };

  const isAuthPage = [
    `/${lang}/authentication/sign-in/`,
    `/${lang}/authentication/sign-up/`,
    `/${lang}/authentication/forgot-password/`,
    `/${lang}/authentication/reset-password/`,
    `/${lang}/authentication/confirm-email/`,
    `/${lang}/authentication/lock-screen/`,
    `/${lang}/authentication/logout/`,
    `/${lang}/coming-soon/`,
    `/${lang}/`,
    `/${lang}/front-pages/features/`,
    `/${lang}/front-pages/team/`,
    `/${lang}/front-pages/faq/`,
    `/${lang}/front-pages/contact/`,
  ].includes(pathname);

  return (
    <>
      <div className={`main-wrapper-content ${active ? "active" : ""}`}>
        {!isAuthPage && (
          <>
            <TopNavbar toggleActive={toggleActive} topHeaderNavbar={topHeaderNavbar} />

            <LeftSidebarMenu
              toggleActive={toggleActive}
              leftSideMenu={leftSideMenu}
            />
          </>
        )}

        <div className="main-content">
          {children}

          {!isAuthPage && <Footer />}
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: "15px",
          right: "15px",
          zIndex: "-5",
          opacity: 0,
          visibility: "hidden",
        }}
      >
        <ControlPanel />
      </div>
    </>
  );
};

export default LayoutProvider;
