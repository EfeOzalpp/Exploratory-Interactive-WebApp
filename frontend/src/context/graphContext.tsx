import React, { createContext, useContext, useEffect, useState } from "react";
import { unstable_batchedUpdates as batched } from "react-dom";
import { subscribeSurveyData } from "../utils/sanityAPI";

export type Mode = "relative" | "absolute";

export type GraphContextType = {
  // personalization
  section: string;
  setSection: (s: string) => void;

  mySection: string | null;
  setMySection: (s: string | null) => void;

  myEntryId: string | null;
  setMyEntryId: (id: string | null) => void;

  myRole: string | null;
  setMyRole: (r: string | null) => void;

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

  // viz visibility
  vizVisible: boolean;
  openGraph: () => void;
  closeGraph: () => void;

  // relative vs absolute scoring
  mode: Mode;
  setMode: (m: Mode) => void;

  // dark mode
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;

  // NEW: tutorial mode
  tutorialMode: boolean;
  setTutorialMode: (v: boolean) => void;

  // NEW: nav panel open (controls logo gating)
  navPanelOpen: boolean;
  setNavPanelOpen: (v: boolean) => void;

  // NEW: global nav visibility (hide/show entire nav)
  navVisible: boolean;
  setNavVisible: (v: boolean) => void;

  // reset
  resetToStart: () => void;
};

const GraphCtx = createContext<GraphContextType | null>(null);

export const GraphProvider = ({ children }: { children: React.ReactNode }) => {
  const [section, setSection] = useState<string>("all");
  const [mySection, setMySection] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("gp.mySection");
  });
  const [myEntryId, setMyEntryId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("gp.myEntryId");
  });
  const [myRole, setMyRole] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("gp.myRole");
  });

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [isSurveyActive, setSurveyActive] = useState<boolean>(false);
  const [hasCompletedSurvey, setHasCompletedSurvey] = useState<boolean>(false);

  const [observerMode, setObserverMode] = useState<boolean>(false);
  const [vizVisible, setVizVisible] = useState<boolean>(false);
  const openGraph = () => setVizVisible(true);
  const closeGraph = () => setVizVisible(false);

  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "relative";
    const saved = sessionStorage.getItem("gp.mode") as Mode | null;
    return saved === "absolute" || saved === "relative" ? saved : "relative";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("gp.mode", mode);
    }
  }, [mode]);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = sessionStorage.getItem("gp.darkMode");
    return saved === "true";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("gp.darkMode", String(darkMode));
    }
  }, [darkMode]);

  // NEW: tutorial mode — do NOT persist; always start false after a refresh.
  const [tutorialMode, setTutorialMode] = useState<boolean>(false);

  // NEW: nav panel open (drives logo gating)
  const [navPanelOpen, setNavPanelOpen] = useState<boolean>(false);

  // NEW: global nav visibility (entire nav shown/hidden)
  const [navVisible, setNavVisible] = useState<boolean>(true);

  // Cleanup any legacy flags that might force tutorial back on after refresh.
  useEffect(() => {
    try {
      sessionStorage.removeItem("gp.tutorialMode");
      sessionStorage.removeItem("gp.tutorialSeen");
    } catch {}
  }, []);

  // live data
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeSurveyData({
      section,
      onData: (rows: any[]) => {
        setData(rows);
        setLoading(false);
      },
    });
    return () => unsub();
  }, [section]);

  const resetToStart = () => {
    batched(() => {
      closeGraph();
      setSurveyActive(true);
      setHasCompletedSurvey(false);
      setObserverMode(false);
      setMyEntryId(null);
      setMySection(null);
      setMyRole(null);
      setSection("all");
    });
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("gp.myEntryId");
      sessionStorage.removeItem("gp.mySection");
      sessionStorage.removeItem("gp.myRole");
      sessionStorage.removeItem("gp.myDoc");
    }
  };

  return (
    <GraphCtx.Provider
      value={{
        section,
        setSection,
        mySection,
        setMySection,
        myEntryId,
        setMyEntryId,
        myRole,
        setMyRole,
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
        mode,
        setMode,
        darkMode,
        setDarkMode,
        tutorialMode,
        setTutorialMode,
        navPanelOpen,
        setNavPanelOpen,
        navVisible,
        setNavVisible,
        resetToStart,
      }}
    >
      {children}
    </GraphCtx.Provider>
  );
};

export const useGraph = () => {
  const ctx = useContext(GraphCtx);
  if (!ctx) {
    throw new Error("useGraph must be used within a GraphProvider");
  }
  return ctx;
};
