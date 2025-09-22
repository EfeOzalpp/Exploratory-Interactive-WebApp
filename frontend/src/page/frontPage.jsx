// pages/FrontPage.jsx
import React, { useState, useEffect, Suspense, useMemo } from 'react';
import RadialBackground from '../components/static/radialBackground';
import Survey from '../components/survey/survey.jsx';
import Navigation from '../components/nav/navigation.jsx';
import Canvas from '../components/decoy';
import DataVisualization from '../components/dataVisualization';
import { useDynamicMargin } from '../utils/dynamicMargin.ts';
import { GraphProvider, useGraph } from "../context/graphContext.tsx";
import GamificationCopyPreloader from '../utils/gamificationCopyPreloader.tsx';
import '../styles/global-styles.css';

// NOTE: defer these so they only load when the viz actually opens
const EdgeCue = React.lazy(() =>
  import(/* webpackChunkName: "edge-cue" */ '../components/dotGraph/darkMode.jsx')
);
const EdgeModeHint = React.lazy(() =>
  import(/* webpackChunkName: "edge-mode-hint" */ '../cues/EdgeModeHint')
);

// Keep ModeToggle lazy as before
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

  // gate for when the 3D viz + HUD should mount
  const readyForViz = useMemo(
    () => vizVisible && (observerMode || hasCompletedSurvey),
    [vizVisible, observerMode, hasCompletedSurvey]
  );

  // if you want auto-open when conditions met (optional)
  useEffect(() => {
    if (observerMode || hasCompletedSurvey) openGraph();
  }, [observerMode, hasCompletedSurvey, openGraph]);

  // only show (and thus load) ModeToggle when relevant
  const showModeToggle = readyForViz;

  // tighten the global zoom-preventer so it never interferes with the R3F canvas
  useEffect(() => {
    const preventZoom = (event) => {
      // Respect interactions that originate from inside the R3F graph container
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
      {/* Defer HUD mounting until the viz is actually shown & allowed */}
      {readyForViz && (
        <Suspense fallback={null}>
          <EdgeCue />
          <EdgeModeHint />
        </Suspense>
      )}

      <DeferredGamificationPreloader />
      <Navigation />

      {/* Show the lightweight decoy canvas only when the heavy viz is NOT mounted */}
      {!animationVisible && !readyForViz && <Canvas answers={answers} />}

      {/* Only MOUNT the heavy viz when fully allowed */}
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
