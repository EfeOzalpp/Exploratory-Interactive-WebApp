import React, { createContext, useContext, useEffect, useState } from "react";
import { subscribeSurveyData } from "../utils/sanityAPI";

type GraphContextType = {
  // section actively viewed (GraphPicker)
  section: string;
  setSection: (s: string) => void;

  // section the user originally submitted to (sticky across picker changes)
  mySection: string;
  setMySection: (s: string) => void;

  data: any[];
  loading: boolean;

  // survey gating
  isSurveyActive: boolean;
  setSurveyActive: (v: boolean) => void;

  // becomes true once the user completes the survey at least once
  hasCompletedSurvey: boolean;
  setHasCompletedSurvey: (v: boolean) => void;
};

const GraphCtx = createContext<GraphContextType | null>(null);

export const GraphProvider = ({ children }: { children: React.ReactNode }) => {
  const [section, setSection] = useState("");
  const [mySection, setMySection] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [isSurveyActive, setSurveyActive] = useState(false);
  const [hasCompletedSurvey, setHasCompletedSurvey] = useState(false);

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
      }}
    >
      {children}
    </GraphCtx.Provider>
  );
};

export const useGraph = () => {
  const ctx = useContext(GraphCtx);
  if (!ctx) throw new Error("useGraph must be used within GraphProvider");
  return ctx;
};
