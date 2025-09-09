import React, { createContext, useContext, useEffect, useState } from "react";
import { subscribeSurveyData } from "../utils/sanityAPI";

type GraphContextType = {
  // picker + personalization
  section: string;
  setSection: (s: string) => void;
  mySection: string;
  setMySection: (s: string) => void;

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
  const [section, setSection] = useState("");
  const [mySection, setMySection] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [isSurveyActive, setSurveyActive] = useState(false);
  const [hasCompletedSurvey, setHasCompletedSurvey] = useState(false);

  const [observerMode, setObserverMode] = useState(false);
  const [vizVisible, setVizVisible] = useState(false);
  const openGraph = () => setVizVisible(true);
  const closeGraph = () => setVizVisible(false);

  useEffect(() => {
    if (!section) {
      setData([]);
      return;
    }
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
  return ctx;
};
