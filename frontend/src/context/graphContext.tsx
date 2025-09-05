// context/GraphContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { subscribeSurveyData } from "../utils/sanityAPI";

type GraphContextType = {
  section: string;
  setSection: (s: string) => void;
  data: any[];   // you can replace `any[]` with your real survey type
  loading: boolean;
};

const GraphCtx = createContext<GraphContextType | null>(null);

export const GraphProvider = ({ children }: { children: React.ReactNode }) => {
  const [section, setSection] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!section) { setData([]); return; }
    setLoading(true);
    const unsub = subscribeSurveyData({
      section,
      onData: (rows) => { setData(rows); setLoading(false); }
    });
    return () => unsub();
  }, [section]);

  return (
    <GraphCtx.Provider value={{ section, setSection, data, loading }}>
      {children}
    </GraphCtx.Provider>
  );
};

export const useGraph = () => {
  const ctx = useContext(GraphCtx);
  if (!ctx) throw new Error("useGraph must be used within GraphProvider");
  return ctx;
};
