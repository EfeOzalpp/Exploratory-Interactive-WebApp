import React, { createContext, useContext, useEffect, useState } from "react";
import { unstable_batchedUpdates as batched } from "react-dom";
import { subscribeSurveyData } from "../utils/sanityAPI";

type Mode = "relative" | "absolute";

type GraphContextType = {
  // picker + personalization
  section: string;
  setSection: (s: string) => void;

  mySection: string | null;
  setMySection: (s: string | null) => void;

  myEntryId: string | null;
  setMyEntryId: (id: string | null) => void;

  // NEW: how the user entered (student/staff/visitor)
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

  // global viz visibility
  vizVisible: boolean;
  openGraph: () => void;
  closeGraph: () => void;

  // visualization mode (relative percentiles vs absolute score)
  mode: Mode;
  setMode: (m: Mode) => void;

  // canonical dark mode (toggled via EdgeModeHint)
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;

  // NEW: one-shot batched reset to initial/front-page state
  resetToStart: () => void;
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

  // NEW: track how the user entered (student/staff/visitor)
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

  // Global visualization mode (persisted)
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

  // Canonical dark mode (persisted)
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

  // Live data subscription
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

  // NEW: central, batched reset to avoid transitional flicker
  const resetToStart = () => {
    batched(() => {
      closeGraph();
      setSurveyActive(true);
      setHasCompletedSurvey(false);
      setObserverMode(false);
      setMyEntryId(null);
      setMySection(null);
      setMyRole(null);
      setSection("all"); // default landing section
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
