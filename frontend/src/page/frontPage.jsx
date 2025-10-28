// pages/FrontPage.jsx
import React, { useState, useEffect, Suspense, useMemo } from 'react';
import RadialBackground from '../components/static/radialBackground';
import Survey from '../components/survey/survey.jsx';
import Navigation from '../components/nav/navigation.jsx';
import DataVisualization from '../components/dataVisualization';
import { useDynamicMargin } from '../utils/dynamicMargin.ts';
import { GraphProvider, useGraph } from "../context/graphContext.tsx";
import GamificationCopyPreloader from '../utils/gamificationCopyPreloader.tsx';
import '../styles/global-styles.css';

// Lazy-load the q5 canvas entry so it stays out of the main bundle
const CanvasEntry = React.lazy(() =>
  import(/* webpackChunkName: "canvas-entry" */ '../canvas')
);
// HUD bits (lazy)
const EdgeCue = React.lazy(() =>
  import(/* webpackChunkName: "edge-cue" */ '../components/dotGraph/darkMode.jsx')
);
const EdgeModeHint = React.lazy(() =>
  import(/* webpackChunkName: "edge-mode-hint" */ '../cues/EdgeModeHint')
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

  const { vizVisible, openGraph, closeGraph, observerMode, hasCompletedSurvey } = useGraph();
  const setGraphVisible = (v) => (v ? openGraph() : closeGraph());

  // when to allow the heavy viz
  const readyForViz = useMemo(
    () => vizVisible && (observerMode || hasCompletedSurvey),
    [vizVisible, observerMode, hasCompletedSurvey]
  );

  // optional auto-open once allowed
  useEffect(() => {
    if (observerMode || hasCompletedSurvey) openGraph();
  }, [observerMode, hasCompletedSurvey, openGraph]);

  // idle prefetch of the canvas chunk if we aren't ready for viz yet
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

  const showModeToggle = readyForViz;

  // keep the zoom-preventer from interfering with R3F canvas
  useEffect(() => {
    const preventZoom = (event) => {
      const target = event.target;
      const isInsideGraph = target.closest('.graph-container, .dot-graph-container');
      const isCanvasOverlay = target.closest('#canvas-root');

      // Only block if NOT inside graph AND NOT over the canvas overlay
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

  // reset transient UI state when the overlay animation plays
  useEffect(() => {
    if (animationVisible) {
      setAnswers({});
      setLiveAvg(0.5);
      setAllocAvg(0.5);
    }
  }, [animationVisible]);

  return (
    <div className="app-content">
      {/* Defer HUD mount until viz is shown & allowed */}
      {readyForViz && (
        <Suspense fallback={null}>
          <EdgeCue />
          <EdgeModeHint />
        </Suspense>
      )}

      <DeferredGamificationPreloader />
      <Navigation />

      {/* 🔻 IMPORTANT: actually UNMOUNT the Q5 canvas when viz is ready or animation overlay is on */}
      {(!readyForViz && !animationVisible) && (
        <Suspense fallback={null}>
          <CanvasEntry
            answers={answers}
            liveAvg={liveAvg}     // visuals (per-shape lerps, color, etc.)
            allocAvg={allocAvg}   // allocation (placement) – updates on commit only
            visible={true}        // we mount it only when we want it visible
          />
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
