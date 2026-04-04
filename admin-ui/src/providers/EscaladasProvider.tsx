"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const EscaladasContext = createContext(0);

export function EscaladasProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) return;
    function poll() {
      api.getEscaladas().then((r) => setCount(r.length)).catch(() => {});
    }
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  return <EscaladasContext.Provider value={count}>{children}</EscaladasContext.Provider>;
}

export const useEscaladasCount = () => useContext(EscaladasContext);
