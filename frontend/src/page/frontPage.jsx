import React, { useState, useEffect } from 'react';
import '../styles/survey.css';
import '../styles/global-styles.css';
import '../styles/info-graph.css';
import RadialBackground from '../components/static/radialBackground';
import Survey from '../components/survey.jsx';
import Navigation from '../nav/navigation.jsx'; 
import Canvas from '../components/Canvas';
import DataVisualization from '../components/dataVisualization';
import { useDynamicMargin } from '../utils/dynamicMargin.ts';

const FrontPage = () => {
  useDynamicMargin();
  const [animationVisible, setAnimationVisible] = useState(false);
  const [graphVisible, setGraphVisible] = useState(false); // Controls visibility, not rendering
  const [surveyWrapperClass, setSurveyWrapperClass] = useState(''); // Additional class for special button
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    // Disable trackpad and touch device pinch UI zoom in functionality to avoid clashing zoom-in function of dot graph
    const preventZoom = (event) => {
      // Allow pinch zooming inside DotGraph
      const isInsideDotGraph = event.target.closest('.dot-graph-container');

      if (!isInsideDotGraph && (event.ctrlKey || event.touches?.length > 1)) {
        event.preventDefault();
      }
    };

    // Allow pinch gestures in `DotGraph`, block it elsewhere
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
  }, []); // Runs only once when the component mounts

  // Re-render answers upon visibility change
  useEffect(() => {
    if (animationVisible) {
      setAnswers({}); // Reset answers when animation starts
    }
  }, [animationVisible]);

  return (
    <div className="app-content">
        <Navigation /> 
      {!animationVisible && <Canvas answers={answers} />} {/* Render Canvas only when animationVisible is false */}

      {/* Graph always renders, visibility controlled by class */}
      <div className={`graph-wrapper ${graphVisible ? 'visible' : ''}`}>
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

      <RadialBackground />
    </div>
  );
};

export default FrontPage;
