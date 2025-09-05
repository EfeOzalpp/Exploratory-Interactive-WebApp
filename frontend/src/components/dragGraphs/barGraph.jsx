// components/dragGraphs/BarGraph.jsx
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Lottie from 'lottie-react';
import { useGraph } from '../../context/graphContext.tsx'; 
import '../../styles/graph.css';

import tree1 from '../../lottie-for-UI/tree1.json';
import tree2 from '../../lottie-for-UI/tree2.json';
import tree3 from '../../lottie-for-UI/tree3.json';

const BarGraph = () => {
  const { data, loading, section } = useGraph(); // <-- filtered by selected section
  const [animationState, setAnimationState] = useState(false);
  const [animateBars, setAnimateBars] = useState(false);

  const barRefs = useRef({});
  const greenLottieRef = useRef(null);
  const yellowLottieRef = useRef(null);
  const redLottieRef = useRef(null);

  // Kick bar grow animation once data is ready
  useEffect(() => {
    if (!loading) {
      // small delay so layout settles before anim height transitions
      const t = setTimeout(() => setAnimateBars(true), 10);
      return () => clearTimeout(t);
    } else {
      setAnimateBars(false);
    }
  }, [loading, data]);

  // Categorize data into green / yellow / red
  const categories = { green: 0, yellow: 0, red: 0 };
  const percentages = { green: [], yellow: [], red: [] };

  data.forEach((item) => {
    const vals = Object.values(item.weights || {});
    const avgWeight =
      vals.length > 0 ? vals.reduce((sum, w) => sum + w, 0) / vals.length : 0.5;

    if (avgWeight <= 0.33) {
      categories.green++;
      percentages.green.push(avgWeight);
    } else if (avgWeight < 0.60) {
      categories.yellow++;
      percentages.yellow.push(avgWeight);
    } else {
      categories.red++;
      percentages.red.push(avgWeight);
    }
  });

  // "You vs others" percentage
  let percentage = 0;
  if (data.length > 0) {
    const latestVals = Object.values(data[0].weights || {});
    const latestWeight =
      latestVals.length > 0
        ? latestVals.reduce((s, w) => s + w, 0) / latestVals.length
        : 0.5;

    const usersWithHigherWeight = data.filter((entry) => {
      const v = Object.values(entry.weights || {});
      const avg = v.length > 0 ? v.reduce((s, w) => s + w, 0) / v.length : 0.5;
      return avg > latestWeight;
    });

    percentage = Math.round((usersWithHigherWeight.length / data.length) * 100);
  }

  const maxItems = Math.max(categories.green, categories.yellow, categories.red) + 15;

  // write CSS var for the "You" indicator height relative to each bar
  useLayoutEffect(() => {
    Object.entries(barRefs.current).forEach(([color, ref]) => {
      if (!ref) return;
      const heightPercentage =
        (ref.offsetHeight / (ref.parentElement?.offsetHeight || 1)) * 100;
      ref.style.setProperty('--user-percentage', `${(percentage / 100) * heightPercentage}%`);
    });
  }, [percentage, animateBars]);

  // Lottie speeds
  useEffect(() => {
    const applySpeed = () => {
      greenLottieRef.current?.setSpeed(0.3);
      yellowLottieRef.current?.setSpeed(0.2);
      redLottieRef.current?.setSpeed(0.5);
    };

    const checkRefs = setInterval(() => {
      if (greenLottieRef.current && yellowLottieRef.current && redLottieRef.current) {
        applySpeed();
        clearInterval(checkRefs);
      }
    }, 100);

    return () => clearInterval(checkRefs);
  }, []);

  useEffect(() => {
    if (!animationState) {
      const t = setTimeout(() => setAnimationState(true), 200);
      return () => clearTimeout(t);
    }
  }, [animationState]);

  // UX guards
  if (!section) return <p className="graph-loading">Pick a section to begin.</p>;
  if (loading) return null;

  return (
    <>
      <div className="bar-graph-container">
        {Object.entries(categories).map(([color, count]) => {
          const heightPercentage = (count / maxItems) * 100;

          // sectionTop defines which bar shows the "You" marker
          let sectionTop = 100;
          if (color === 'yellow') sectionTop = 60;
          if (color === 'red') sectionTop = 33;

          const relativePercentage = (percentage / sectionTop) * 100;
          let userPercentage = (relativePercentage / 100) * heightPercentage;
          userPercentage = Math.min(userPercentage, heightPercentage);

          const showPercentage =
            (percentage <= 33 && color === 'red') ||
            (percentage > 33 && percentage <= 60 && color === 'yellow') ||
            (percentage > 60 && color === 'green');

          return (
            <div
              className="bar-graph-bar"
              key={color}
              ref={(el) => (barRefs.current[color] = el)}
            >
              <span className="bar-graph-label">
                <p>{count} People</p>
              </span>

              <div className="bar-graph-divider">
                {showPercentage && (
                  <div
                    className="percentage-section"
                    style={{
                      height: animateBars ? `calc(${userPercentage}% - 4.1em)` : '0%',
                    }}
                  >
                    <div className="percentage-indicator">
                      <p>You</p>
                      <p>{percentage}%</p>
                    </div>
                  </div>
                )}

                <div
                  className={`bar-graph-fill ${color}-animation`}
                  style={{ height: animateBars ? `${heightPercentage}%` : '0%' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bar-graph-icons">
        <div className="bar-icon">
          <Lottie
            animationData={tree1}
            loop
            autoplay
            lottieRef={greenLottieRef}
            initialSegment={animationState ? [5, 55] : [0, 55]}
            onDOMLoaded={() =>
              setTimeout(() => greenLottieRef.current?.setSpeed(0.3), 50)
            }
          />
        </div>

        <div className="bar-icon">
          <Lottie
            animationData={tree2}
            loop
            autoplay
            lottieRef={yellowLottieRef}
            initialSegment={animationState ? [5, 55] : [0, 55]}
            onDOMLoaded={() =>
              setTimeout(() => yellowLottieRef.current?.setSpeed(0.2), 50)
            }
          />
        </div>

        <div className="bar-icon">
          <Lottie
            animationData={tree3}
            loop
            autoplay
            lottieRef={redLottieRef}
            initialSegment={animationState ? [5, 55] : [0, 55]}
            onDOMLoaded={() =>
              setTimeout(() => redLottieRef.current?.setSpeed(0.5), 50)
            }
          />
        </div>
      </div>
    </>
  );
};

export default BarGraph;
