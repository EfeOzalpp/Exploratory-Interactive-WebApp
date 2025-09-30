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

  // optional: idle prefetch of the canvas chunk if we aren't ready for viz yet
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
      const isInsideGraph = event.target.closest('.graph-container, .dot-graph-container');
      if (!isInsideGraph && (event.ctrlKey || event.touches?.length > 1)) {
        event.preventDefault();
      }
    };
    document.addEventListener('wheel', preventZoom, { passive: false });
    document.addEventListener('gesturestart', preventZoom);
    document.addEventListener('gesturechange', preventZoom);
    document.addEventListener('gestureend', preventZoom);
    document.addEventListener('touchmove', preventZoom, { passive: false });
    return () => {
      document.removeEventListener('wheel', preventZoom);
      document.removeEventListener('gesturestart', preventZoom);
      document.removeEventListener('gesturechange', preventZoom);
      document.removeEventListener('gestureend', preventZoom);
      document.removeEventListener('touchmove', preventZoom);
    };
  }, []);

  useEffect(() => {
    if (animationVisible) setAnswers({});
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

      <Suspense fallback={null}>
        <CanvasEntry answers={answers} visible={!readyForViz && !animationVisible} />
      </Suspense>

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
