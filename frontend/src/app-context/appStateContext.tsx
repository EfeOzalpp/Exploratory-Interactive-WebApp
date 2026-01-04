// src/context/appStateContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { unstable_batchedUpdates as batched } from "react-dom";

import { subscribeSurveyData } from "../utils-hooks/sanityAPI.js";
import useSectionCounts from "../utils-hooks/useSectionCounts.ts";

export type Mode = "relative" | "absolute";

export type AvgController = {
  live: number;              // continuous signal
  committed: number;         // structural / commit-only value
  setLive: (avg?: number) => void;
  commit: (avg?: number) => void;
  commitFromLive: () => void;
};

export type AppState = {
  // data collecting and personalization
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

  // graph and visualization visibility
  vizVisible: boolean;
  openGraph: () => void;
  closeGraph: () => void;

  // relative vs absolute scoring toggle
  mode: Mode;
  setMode: (m: Mode) => void;

  // dark mode toggle
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;

  // nav panel open (controls logo gating)
  navPanelOpen: boolean;
  setNavPanelOpen: (v: boolean) => void;

  // global nav visibility (hide/show entire nav in certain circumstances)
  navVisible: boolean;
  setNavVisible: (v: boolean) => void;

  // avg controller (signal vs commit)
  avg: AvgController;

  // reset
  resetToStart: () => void;
};

const AppCtx = createContext<AppState | null>(null);

// Single baseline used everywhere
export const DEFAULT_AVG = 0.5;

function normalizeAvg(avg: unknown) {
  return typeof avg === "number" && Number.isFinite(avg) ? avg : DEFAULT_AVG;
}

function clamp01(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

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

  // Two averages on purpose:
  // - avg.live: continuous updates for visuals
  // - avg.committed: commit-only updates for layout/allocation
  const [liveAvgState, _setLiveAvgState] = useState<number>(DEFAULT_AVG);
  const [committedAvgState, _setCommittedAvgState] = useState<number>(DEFAULT_AVG);

  // Keep setters stable and semantics clear
  const avg = useMemo<AvgController>(() => {
    const setLive = (v?: number) => {
      const n = clamp01(normalizeAvg(v));
      _setLiveAvgState(n);
    };

    const commit = (v?: number) => {
      const n = clamp01(normalizeAvg(v));
      _setCommittedAvgState(n);
    };

    const commitFromLive = () => {
      _setCommittedAvgState(liveAvgState);
    };

    return {
      live: liveAvgState,
      committed: committedAvgState,
      setLive,
      commit,
      commitFromLive,
    };
  }, [liveAvgState, committedAvgState]);

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

  // Identity sync (custom event + storage changes)
  useEffect(() => {
    if (typeof window === "undefined") return;

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

    const effectiveMySection = mySection || sessionStorage.getItem("gp.mySection") || "";
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

      // reset averages too
      _setLiveAvgState(DEFAULT_AVG);
      _setCommittedAvgState(DEFAULT_AVG);
    });

    if (typeof window !== "undefined") {
      sessionStorage.removeItem("gp.myEntryId");
      sessionStorage.removeItem("gp.mySection");
      sessionStorage.removeItem("gp.myRole");
      sessionStorage.removeItem("gp.myDoc");
    }
  };

  const value = useMemo<AppState>(
    () => ({
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
      avg,
      resetToStart,
    }),
    [
      section,
      mySection,
      myEntryId,
      myRole,
      data,
      loading,
      isSurveyActive,
      hasCompletedSurvey,
      questionnaireOpen,
      observerMode,
      vizVisible,
      mode,
      darkMode,
      navPanelOpen,
      navVisible,
      avg,
    ]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
};

export const useAppState = () => {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useAppState must be used within an AppProvider");
  return ctx;
};
