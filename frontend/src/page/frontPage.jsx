// pages/FrontPage.jsx
import React, { useState, useEffect } from 'react';
import RadialBackground from '../components/static/radialBackground';
import Survey from '../components/survey/survey.jsx';
import Navigation from '../components/nav/navigation.jsx';
import Canvas from '../components/decoy';
import DataVisualization from '../components/dataVisualization';
import { useDynamicMargin } from '../utils/dynamicMargin.ts';
import { GraphProvider, useGraph } from "../context/graphContext.tsx";
import GamificationCopyPreloader from '../utils/gamificationCopyPreloader.tsx';
import ModeToggle from '../components/nav-bottom/modeToggle';
import '../styles/global-styles.css';

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

  // local UI bits
  const [animationVisible, setAnimationVisible] = useState(false);
  const [surveyWrapperClass, setSurveyWrapperClass] = useState('');
  const [answers, setAnswers] = useState({});

  // global viz control + gating
  const { vizVisible, openGraph, closeGraph, observerMode, hasCompletedSurvey } = useGraph();
  const setGraphVisible = (v) => (v ? openGraph() : closeGraph());

  // show toggle only when viz is visible AND (observer OR hasCompletedSurvey)
  const showModeToggle = vizVisible && (observerMode || hasCompletedSurvey);

  useEffect(() => {
    // Allow pinch inside dot graph only
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

      {/* Hide the q5 Canvas whenever the 3D viz is visible OR the overlay is animating */}
      {!animationVisible && !vizVisible && <Canvas answers={answers} />}

      {/* 3D visualization is always mounted; visibility via class */}
      <div className={`graph-wrapper ${vizVisible ? 'visible' : ''}`}>
        <DataVisualization />
      </div>

      {/* Survey */}
      <div className={`survey-section-wrapper3 ${surveyWrapperClass}`}>
        <Survey
          setAnimationVisible={setAnimationVisible}
          setGraphVisible={setGraphVisible}
          setSurveyWrapperClass={setSurveyWrapperClass}
          onAnswersUpdate={setAnswers}
        />
      </div>

      {/* Bottom mode toggle (guarded) */}
      {showModeToggle && <ModeToggle />}

      <RadialBackground />
    </div>
  );
};

// Keep GraphProvider outside the consumer
const FrontPage = () => (
  <GraphProvider>
    <FrontPageInner />
  </GraphProvider>
);

export default FrontPage;
