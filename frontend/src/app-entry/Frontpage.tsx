// pages/Frontpage.tsx

import React, { useState, useEffect, useMemo, Suspense } from "react";

import { AppProvider, useAppState } from "../app-context/appStateContext.tsx";

import Survey from "../weighted-survey/Survey.tsx";

import Navigation from "../navigation/Navigation.jsx";
import CityButton from "../navigation/CityButton.tsx";

import DataVisualization from "../graph-runtime/index.tsx"; // Contains the graph visualizations

import { useDynamicMargin } from "../utils-hooks/dynamicMargin.ts";

import GamificationCopyPreloader from "../utils-hooks/gamificationCopyPreloader.tsx";

import { usePreventPageZoomOutsideZones } from "../utils-hooks/usePreventPageZoom.ts";
import RadialBackground from "../static-assets/static/radialBackground.jsx";
import "../static-assets/styles/global-styles.css";

const CanvasEntry = React.lazy(() => import("../weighted-survey/CanvasEntry.tsx"));

const CityOverlay = React.lazy(() => import("../navigation/CityOverlay.tsx"));

const EdgeCue = React.lazy(() => import("../navigation/DarkMode.jsx"));

const ModeToggle = React.lazy(() => import("../navigation/nav-bottom/ModeToggle.jsx"));

function DeferredGamificationPreloader() {
  const [start, setStart] = useState<boolean>(false);

  useEffect(() => {
    const cb = () => setStart(true);
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(cb, { timeout: 1500 });
    } else {
      setTimeout(cb, 0);
    }
  }, []);

  return start ? <GamificationCopyPreloader /> : null;
}
const AppInner: React.FC = () => {
  useDynamicMargin();

  const [animationVisible, setAnimationVisible] = useState<boolean>(false);
  const [surveyWrapperClass, setSurveyWrapperClass] = useState<string>("");
  const [cityPanelOpen, setCityPanelOpen] = useState<boolean>(false);

  const {
    vizVisible,
    observerMode,
    hasCompletedSurvey,
    questionnaireOpen,
    liveAvg,
    allocAvg,
  } = useAppState();

  // Extracted global zoom prevention policy
  usePreventPageZoomOutsideZones({
    allowWithin: [".graph-container", ".dot-graph-container", "#canvas-root", "#city-canvas-root"],
  });
  
  // Heavy viz allowed when visible AND (observer or completed survey)
  const readyForViz = useMemo<boolean>(
    () => vizVisible && (observerMode || hasCompletedSurvey),
    [vizVisible, observerMode, hasCompletedSurvey]
  );

  // Idle prefetch of the canvas chunk if we aren't ready for viz yet
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (readyForViz) return;

    const prefetch = () => {
      import("../weighted-survey/CanvasEntry.tsx");};

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(prefetch, { timeout: 1500 });
    } else {
      const t = setTimeout(prefetch, 0);
      return () => clearTimeout(t);
    }
  }, [readyForViz]);

  // Keep city overlay closed if questionnaire closes
  useEffect(() => {
    if (!questionnaireOpen && cityPanelOpen) setCityPanelOpen(false);
  }, [questionnaireOpen, cityPanelOpen]);

  const showModeToggle = readyForViz;

  return (
    <div className="app-content">
      {/* Defer HUD mount until viz is shown & allowed */}
      {readyForViz && (
        <Suspense fallback={null}>
          <EdgeCue />
        </Suspense>
      )}

      <DeferredGamificationPreloader />
      <Navigation />

      {/* City button appears only while questionnaire is open */}
      {questionnaireOpen && (
        <CityButton isOpen={cityPanelOpen} onToggle={() => setCityPanelOpen((o) => !o)} shown />
      )}

      {/* Intro canvas UNMOUNTED while city overlay is open or while animation overlay is on */}
      {!readyForViz && !animationVisible && !cityPanelOpen && (
        <Suspense fallback={null}>
        <CanvasEntry
          liveAvg={liveAvg}
          allocAvg={allocAvg}
          questionnaireOpen={questionnaireOpen}
          visible={true}
        />
        </Suspense>
      )}

      {/* City overlay canvas mounts only when button is open AND questionnaire is open */}
      {cityPanelOpen && questionnaireOpen && (
        <Suspense fallback={null}>
          <CityOverlay open={true} liveAvg={liveAvg} />
        </Suspense>
      )}

      {/* Heavy viz mounts only when fully allowed */}
      {readyForViz && (
        <div className={`graph-wrapper ${vizVisible ? "visible" : ""}`}>
          <DataVisualization />
        </div>
      )}

      <div className={`survey-section-wrapper3 ${surveyWrapperClass}`}>
        <Survey
          setAnimationVisible={setAnimationVisible}
          setSurveyWrapperClass={setSurveyWrapperClass}
        />
      </div>

      {showModeToggle && (
        <Suspense fallback={null}>
          <ModeToggle />
        </Suspense>
      )}

      <RadialBackground />
    </div>
  );
};

const AppShell: React.FC = () => (
  <AppProvider>
    <AppInner />
  </AppProvider>
);

export default AppShell;
