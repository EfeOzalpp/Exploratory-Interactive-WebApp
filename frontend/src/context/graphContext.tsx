// context/graphContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { subscribeSurveyData } from "../utils/sanityAPI";

type GraphContextType = {
  // picker + personalization
  section: string;
  setSection: (s: string) => void;

  mySection: string | null;                     // <- allow null
  setMySection: (s: string | null) => void;     // <- allow null

  myEntryId: string | null;                    
  setMyEntryId: (id: string | null) => void;    

  data: any[];
  loading: boolean;

  // survey gating
  isSurveyActive: boolean;
  setSurveyActive: (v: boolean) => void;
  hasCompletedSurvey: boolean;
  setHasCompletedSurvey: (v: boolean) => void;

  // observer mode
  observerMode: boolean;
  setObserverMode: (v: boolean) => void;

  // global viz visibility
  vizVisible: boolean;
  openGraph: () => void;
  closeGraph: () => void;
};

const GraphCtx = createContext<GraphContextType | null>(null);

export const GraphProvider = ({ children }: { children: React.ReactNode }) => {
  // Default to "all" → shows everything by default
  const [section, setSection] = useState<string>("all");

  // Initialize from sessionStorage when available
  const [mySection, setMySection] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("gp.mySection");
  });

  const [myEntryId, setMyEntryId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("gp.myEntryId");
  });

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [isSurveyActive, setSurveyActive] = useState<boolean>(false);
  const [hasCompletedSurvey, setHasCompletedSurvey] = useState<boolean>(false);

  const [observerMode, setObserverMode] = useState<boolean>(false);
  const [vizVisible, setVizVisible] = useState<boolean>(false);
  const openGraph = () => setVizVisible(true);
  const closeGraph = () => setVizVisible(false);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeSurveyData({
      section,
      onData: (rows) => {
        setData(rows);
        setLoading(false);
      },
    });
    return () => unsub();
  }, [section]);

  return (
    <GraphCtx.Provider
      value={{
        section,
        setSection,
        mySection,
        setMySection,
        myEntryId,          
        setMyEntryId,      
        data,
        loading,
        isSurveyActive,
        setSurveyActive,
        hasCompletedSurvey,
        setHasCompletedSurvey,
        observerMode,
        setObserverMode,
        vizVisible,
        openGraph,
        closeGraph,
      }}
    >
      {children}
    </GraphCtx.Provider>
  );
};

export const useGraph = () => {
  const ctx = useContext(GraphCtx);
  return ctx!;
};
