// pages/FrontPage.jsx
import React, { useState, useEffect, Suspense, useMemo } from 'react';
import RadialBackground from '../components/static/radialBackground';
import Survey from '../components/survey/survey.tsx';
import Navigation from '../components/nav/navigation.jsx';
import CityButton from '../components/nav/CityButton.tsx';
import DataVisualization from '../components/dataVisualization';
import { useDynamicMargin } from '../utils/dynamicMargin.ts';
import { GraphProvider, useGraph } from "../context/graphContext.tsx";
import GamificationCopyPreloader from '../utils/gamificationCopyPreloader.tsx';
import '../styles/global-styles.css';

// Lazy-load the q5 canvas entry so it stays out of the main bundle
const CanvasEntry = React.lazy(() =>
  import(/* webpackChunkName: "canvas-entry" */ '../canvas')
);

// City overlay canvas instance (renders into #city-canvas-root)
const CityOverlay = React.lazy(() =>
  import(/* webpackChunkName: "city-overlay" */ '../components/nav/CityOverlay.jsx')
);

// HUD bits (lazy)
const EdgeCue = React.lazy(() =>
  import(/* webpackChunkName: "edge-cue" */ '../components/dotGraph/darkMode.jsx')
);
const ModeToggle = React.lazy(() =>
  import(/* webpackChunkName: "mode-toggle" */ '../components/nav-bottom/modeToggle')
);

function DeferredGamificationPreloader() {
  const [start, setStart] = useState(false);
  useEffect(() => {
    const cb = () => setStart(true);
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(cb, { timeout: 1500 });
    } else {
      setTimeout(cb, 0);
    }
  }, []);
  return start ? <GamificationCopyPreloader /> : null;
}

const FrontPageInner = () => {
  useDynamicMargin();

  const [animationVisible, setAnimationVisible] = useState(false);
  const [surveyWrapperClass, setSurveyWrapperClass] = useState('');
  const [answers, setAnswers] = useState({});
  const [liveAvg, setLiveAvg]   = useState(0.5); // drives visual lerps
  const [allocAvg, setAllocAvg] = useState(0.5); // drives shape reallocation only on commit
  const [cityPanelOpen, setCityPanelOpen] = useState(false);

  const {
    vizVisible,
    openGraph,
    closeGraph,
    observerMode,
    hasCompletedSurvey,
    questionnaireOpen, // ← drives CityButton visibility and overlay availability
  } = useGraph();

  const setGraphVisible = (v) => (v ? openGraph() : closeGraph());

  // Heavy viz allowed when visible AND (observer or completed survey)
  const readyForViz = useMemo(
    () => vizVisible && (observerMode || hasCompletedSurvey),
    [vizVisible, observerMode, hasCompletedSurvey]
  );

  // Auto-open once allowed
  useEffect(() => {
    if (observerMode || hasCompletedSurvey) openGraph();
  }, [observerMode, hasCompletedSurvey, openGraph]);

  // Idle prefetch of the canvas chunk if we aren't ready for viz yet
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (readyForViz) return;
    const prefetch = () => {
      import(/* webpackPrefetch: true, webpackChunkName: "canvas-entry" */ '../canvas');
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(prefetch, { timeout: 1500 });
    } else {
      const t = setTimeout(prefetch, 0);
      return () => clearTimeout(t);
    }
  }, [readyForViz]);

  // Prevent pinch/ctrl zoom outside graph & outside overlays
  useEffect(() => {
    const preventZoom = (event) => {
      const target = event.target;
      const isInsideGraph = target.closest('.graph-container, .dot-graph-container');
      const isCanvasOverlay =
        target.closest('#canvas-root') || target.closest('#city-canvas-root');
      if (!isInsideGraph && !isCanvasOverlay) {
        const multiTouch = Array.isArray(event.touches) ? event.touches.length > 1 : false;
        if (event.ctrlKey || multiTouch) {
          event.preventDefault();
        }
      }
    };
    document.addEventListener('wheel', preventZoom, { passive: false });
    document.addEventListener('gesturestart', preventZoom, { passive: false });
    document.addEventListener('gesturechange', preventZoom, { passive: false });
    document.addEventListener('gestureend', preventZoom, { passive: false });
    document.addEventListener('touchmove', preventZoom, { passive: false });
    return () => {
      document.removeEventListener('wheel', preventZoom);
      document.removeEventListener('gesturestart', preventZoom);
      document.removeEventListener('gesturechange', preventZoom);
      document.removeEventListener('gestureend', preventZoom);
      document.removeEventListener('touchmove', preventZoom);
    };
  }, []);

  // Reset transient UI state when the overlay animation plays
  useEffect(() => {
    if (animationVisible) {
      setAnswers({});
      setLiveAvg(0.5);
      setAllocAvg(0.5);
    }
  }, [animationVisible]);

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
        <CityButton
          isOpen={cityPanelOpen}
          onToggle={() => setCityPanelOpen((o) => !o)}
          shown
        />
      )}

      {/* Intro canvas UNMOUNTED while city overlay is open or while animation overlay is on */}
      {(!readyForViz && !animationVisible && !cityPanelOpen) && (
        <Suspense fallback={null}>
          <CanvasEntry
            answers={answers}
            liveAvg={liveAvg}     // visuals (per-shape lerps, color, etc.)
            allocAvg={allocAvg}   // allocation (placement) – updates on commit only
            visible={true}        // we mount it only when we want it visible
          />
        </Suspense>
      )}

      {/* City overlay canvas mounts only when button is open AND questionnaire is open */}
      {(cityPanelOpen && questionnaireOpen) && (
        <Suspense fallback={null}>
          <CityOverlay open={true} liveAvg={liveAvg} />
        </Suspense>
      )}

      {/* Heavy viz mounts only when fully allowed */}
      {readyForViz && (
        <div className={`graph-wrapper ${vizVisible ? 'visible' : ''}`}>
          <DataVisualization />
        </div>
      )}

      <div className={`survey-section-wrapper3 ${surveyWrapperClass}`}>
        <Survey
          setAnimationVisible={setAnimationVisible}
          setGraphVisible={setGraphVisible}
          setSurveyWrapperClass={setSurveyWrapperClass}
          onAnswersUpdate={setAnswers}
          onLiveAverageChange={(avg, meta) => {
            // always update visuals
            if (typeof avg === 'number') setLiveAvg(avg);
            // only re-allocate when the gesture commits
            if (meta?.committed && typeof avg === 'number') setAllocAvg(avg);
          }}
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

const FrontPage = () => (
  <GraphProvider>
    <FrontPageInner />
  </GraphProvider>
);

export default FrontPage;
