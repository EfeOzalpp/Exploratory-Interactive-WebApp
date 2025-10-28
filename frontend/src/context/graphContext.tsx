import React, { createContext, useContext, useEffect, useState } from "react";
import { unstable_batchedUpdates as batched } from "react-dom";
import { subscribeSurveyData } from "../utils/sanityAPI";
import useSectionCounts from "../utils/useSectionCounts";

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

  // live counts (already powering GraphPicker)
  const { counts } = useSectionCounts();

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [isSurveyActive, setSurveyActive] = useState<boolean>(false);
  const [hasCompletedSurvey, setHasCompletedSurvey] = useState<boolean>(false);

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

  // live data subscription for the active section
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

  // Sync identity fields when saveUserResponse updates sessionStorage (without remount)
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
    // also react to cross-tab storage changes
    window.addEventListener("storage", onIdentityUpdated);
    return () => {
      window.removeEventListener("gp:identity-updated", onIdentityUpdated);
      window.removeEventListener("storage", onIdentityUpdated);
    };
  }, []);

  // --- One-time “better first view” after submit (no redirect, just initial choice) ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    // only run immediately after a new submission
    const justSubmitted = sessionStorage.getItem("gp.justSubmitted") === "1";
    if (!justSubmitted) return;
    if (!counts) return; // wait until counts are available

    // tolerate a brief window where context hasn't updated yet
    const effectiveMySection =
      mySection || sessionStorage.getItem("gp.mySection") || "";

    if (!effectiveMySection) return;

    // keep visitors in Visitors
    if (effectiveMySection === "visitor") {
      sessionStorage.removeItem("gp.justSubmitted");
      return;
    }

    const n = counts[effectiveMySection] ?? 0;
    const SMALL_SECTION_THRESHOLD = 5;
    if (n < SMALL_SECTION_THRESHOLD) {
      // open on a fuller bucket the first time
      setSection("all-massart");
      // mark that we want the personalized panel opened when the graph is ready
      try {
        sessionStorage.setItem("gp.openPersonalOnNext", "1");
      } catch {}
    }

    // clear the flag so we never run this again
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
