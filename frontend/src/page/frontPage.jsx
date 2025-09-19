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

// Lazily load ModeToggle (kept out of first paint)
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

  // only show (and thus load) ModeToggle when relevant
  const showModeToggle = useMemo(
    () => vizVisible && (observerMode || hasCompletedSurvey),
    [vizVisible, observerMode, hasCompletedSurvey]
  );

  useEffect(() => {
    const preventZoom = (event) => {
      const isInsideDotGraph = event.target.closest('.dot-graph-container');
      if (!isInsideDotGraph && (event.ctrlKey || event.touches?.length > 1)) {
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
      <DeferredGamificationPreloader />
      <Navigation />

      {!animationVisible && !vizVisible && <Canvas answers={answers} />}

      <div className={`graph-wrapper ${vizVisible ? 'visible' : ''}`}>
        <DataVisualization />
      </div>

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
