// src/context/appStateContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { unstable_batchedUpdates as batched } from "react-dom";
import { subscribeSurveyData } from "../utils/sanityAPI";
import useSectionCounts from "../utils/useSectionCounts";

export type Mode = "relative" | "absolute";

export type AppState = {
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

  // survey gating (broad survey-on/off)
  isSurveyActive: boolean;
  setSurveyActive: (v: boolean) => void;
  hasCompletedSurvey: boolean;
  setHasCompletedSurvey: (v: boolean) => void;

  // specific: question flow currently visible?
  questionnaireOpen: boolean;
  setQuestionnaireOpen: (v: boolean) => void;

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

  // nav panel open (controls logo gating)
  navPanelOpen: boolean;
  setNavPanelOpen: (v: boolean) => void;

  // global nav visibility (hide/show entire nav)
  navVisible: boolean;
  setNavVisible: (v: boolean) => void;

  // reset
  resetToStart: () => void;
};

const AppCtx = createContext<AppState | null>(null);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
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

  const { counts } = useSectionCounts();

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [isSurveyActive, setSurveyActive] = useState<boolean>(false);
  const [hasCompletedSurvey, setHasCompletedSurvey] = useState<boolean>(false);

  const [questionnaireOpen, setQuestionnaireOpen] = useState<boolean>(false);

  const [observerMode, setObserverMode] = useState<boolean>(false);
  const [vizVisible, setVizVisible] = useState<boolean>(false);
  const openGraph = () => setVizVisible(true);
  const closeGraph = () => setVizVisible(false);

  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "absolute";
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

  const [navPanelOpen, setNavPanelOpen] = useState<boolean>(false);
  const [navVisible, setNavVisible] = useState<boolean>(true);

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

  useEffect(() => {
    const onIdentityUpdated = () => {
      try {
        const id = sessionStorage.getItem("gp.myEntryId");
        const sec = sessionStorage.getItem("gp.mySection");
        const role = sessionStorage.getItem("gp.myRole");
        setMyEntryId(id);
        setMySection(sec);
        setMyRole(role);
      } catch {}
    };
    window.addEventListener("gp:identity-updated", onIdentityUpdated);
    window.addEventListener("storage", onIdentityUpdated);
    return () => {
      window.removeEventListener("gp:identity-updated", onIdentityUpdated);
      window.removeEventListener("storage", onIdentityUpdated);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const justSubmitted = sessionStorage.getItem("gp.justSubmitted") === "1";
    if (!justSubmitted) return;
    if (!counts) return;

    const effectiveMySection =
      mySection || sessionStorage.getItem("gp.mySection") || "";
    if (!effectiveMySection) return;

    if (effectiveMySection === "visitor") {
      sessionStorage.removeItem("gp.justSubmitted");
      return;
    }

    const n = counts[effectiveMySection] ?? 0;
    const SMALL_SECTION_THRESHOLD = 5;
    if (n < SMALL_SECTION_THRESHOLD) {
      setSection("all-massart");
      try {
        sessionStorage.setItem("gp.openPersonalOnNext", "1");
      } catch {}
    }

    sessionStorage.removeItem("gp.justSubmitted");
  }, [counts, mySection]);

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
      setQuestionnaireOpen(false); 
    });
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("gp.myEntryId");
      sessionStorage.removeItem("gp.mySection");
      sessionStorage.removeItem("gp.myRole");
      sessionStorage.removeItem("gp.myDoc");
    }
  };

  return (
    <AppCtx.Provider
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
        questionnaireOpen,            
        setQuestionnaireOpen,         
        observerMode,
        setObserverMode,
        vizVisible,
        openGraph,
        closeGraph,
        mode,
        setMode,
        darkMode,
        setDarkMode,
        navPanelOpen,
        setNavPanelOpen,
        navVisible,
        setNavVisible,
        resetToStart,
      }}
    >
      {children}
    </AppCtx.Provider>
  );
};

export const useAppState = () => {
  const ctx = useContext(AppCtx);
  if (!ctx) {
    throw new Error("useAppState must be used within an AppProvider");
  }
  return ctx;
};
