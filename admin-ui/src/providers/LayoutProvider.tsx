"use client";

import React, { useState, useEffect, ReactNode } from "react";
import { usePathname, useParams, useRouter } from "next/navigation";
import LeftSidebarMenu from "@/components/Layout/LeftSidebarMenu";
import TopNavbar from "@/components/Layout/TopNavbar/index";
import Footer from "@/components/Layout/Footer";
import { EscaladasProvider } from "@/providers/EscaladasProvider";

interface LayoutProviderProps {
  children: ReactNode;
  leftSideMenu?: any;
  topHeaderNavbar?: any;
}

const LayoutProvider: React.FC<LayoutProviderProps> = ({ children, leftSideMenu, topHeaderNavbar }) => {
  const { lang } = useParams();
  const [active, setActive] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname?.includes("/authentication/sign-in");

  useEffect(() => {
    if (!isAuthPage && !localStorage.getItem("admin_token")) {
      router.replace(`/${lang}/authentication/sign-in/`);
    }
  }, [isAuthPage, lang, router]);
  return (
    <EscaladasProvider>
    <div className={`main-wrapper-content ${active ? "active" : ""}`}>
      {!isAuthPage && (
        <>
          <TopNavbar toggleActive={() => setActive(!active)} topHeaderNavbar={topHeaderNavbar} />
          <LeftSidebarMenu toggleActive={() => setActive(!active)} leftSideMenu={leftSideMenu} />
        </>
      )}
      <div className="main-content">
        {children}
        {!isAuthPage && <Footer />}
      </div>
    </div>
    </EscaladasProvider>
  );
};

export default LayoutProvider;
