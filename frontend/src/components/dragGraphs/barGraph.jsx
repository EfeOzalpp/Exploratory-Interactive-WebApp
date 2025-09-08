import React, { useState, useEffect, useRef, useLayoutEffect, Suspense } from 'react';
import { useGraph } from '../../context/graphContext.tsx';
import '../../styles/graph.css';

// lazy-load the wrapper once
const Lottie = React.lazy(() =>
  import(/* webpackChunkName: "lottie-react" */ 'lottie-react')
);

// small helper that lazy-loads a JSON and renders a Lottie
function TreeIcon({ jsonLoader, speed = 0.3, initialSegment = [5, 55] }) {
  const ref = useRef(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    jsonLoader().then((mod) => { if (alive) setData(mod.default || mod); });
    return () => { alive = false; };
  }, [jsonLoader]);

  useEffect(() => {
    if (ref.current) {
      const t = setTimeout(() => ref.current?.setSpeed(speed), 50);
      return () => clearTimeout(t);
    }
  }, [data, speed]);

  return (
    <div className="bar-icon">
      <Suspense fallback={null}>
        {data && (
          <Lottie
            animationData={data}
            loop
            autoplay
            lottieRef={ref}
            initialSegment={initialSegment}
          />
        )}
      </Suspense>
    </div>
  );
}

const BarGraph = () => {
  // 🚩 Pull mySection + hasCompletedSurvey to gate the personalized “You” marker
  const { data, loading, section, mySection, hasCompletedSurvey } = useGraph();

  const [animationState, setAnimationState] = useState(false);
  const [animateBars, setAnimateBars] = useState(false);
  const barRefs = useRef({});

  // “You” should show only on the user’s own section and after first survey completion
  const canShowYou = Boolean(hasCompletedSurvey && mySection && section === mySection);

  // Kick bar grow animation once data is ready
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setAnimateBars(true), 10);
      return () => clearTimeout(t);
    } else {
      setAnimateBars(false);
    }
  }, [loading, data]);

  // Categorize data
  const categories = { green: 0, yellow: 0, red: 0 };

  data.forEach((item) => {
    const vals = Object.values(item.weights || {});
    const avg = vals.length ? vals.reduce((s, w) => s + w, 0) / vals.length : 0.5;

    if (avg <= 0.33) categories.green++;
    else if (avg < 0.60) categories.yellow++;
    else categories.red++;
  });

  // "You vs others" percentage — compute only when eligible
  let percentage = 0;
  if (canShowYou && data.length > 0) {
    const latestVals = Object.values(data[0].weights || {});
    const latestAvg = latestVals.length
      ? latestVals.reduce((s, w) => s + w, 0) / latestVals.length
      : 0.5;

    const higher = data.filter((entry) => {
      const v = Object.values(entry.weights || {});
      const avg = v.length ? v.reduce((s, w) => s + w, 0) / v.length : 0.5;
      return avg > latestAvg;
    });

    percentage = Math.round((higher.length / data.length) * 100);
  }

  const maxItems = Math.max(categories.green, categories.yellow, categories.red) + 15;

  // write CSS var for the "You" indicator height relative to each bar
  useLayoutEffect(() => {
    Object.entries(barRefs.current).forEach(([_, ref]) => {
      if (!ref) return;
      if (!canShowYou) {
        ref.style.setProperty('--user-percentage', '0%');
        return;
      }
      const heightPercentage =
        (ref.offsetHeight / (ref.parentElement?.offsetHeight || 1)) * 100;
      ref.style.setProperty('--user-percentage', `${(percentage / 100) * heightPercentage}%`);
    });
  }, [percentage, animateBars, canShowYou]);

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

          // only show when eligible AND the marker belongs to this bar
          const showPercentage =
            canShowYou &&
            (
              (percentage <= 33 && color === 'red') ||
              (percentage > 33 && percentage <= 60 && color === 'yellow') ||
              (percentage > 60 && color === 'green')
            );

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

      {/* Lotties: lazy wrapper + lazy JSONs */}
      <div className="bar-graph-icons">
        <TreeIcon
          jsonLoader={() =>
            import(/* webpackChunkName:"lottie-tree1" */ '../../lottie-for-UI/tree1.json')
          }
          speed={0.3}
          initialSegment={animationState ? [5, 55] : [0, 55]}
        />
        <TreeIcon
          jsonLoader={() =>
            import(/* webpackChunkName:"lottie-tree2" */ '../../lottie-for-UI/tree2.json')
          }
          speed={0.2}
          initialSegment={animationState ? [5, 55] : [0, 55]}
        />
        <TreeIcon
          jsonLoader={() =>
            import(/* webpackChunkName:"lottie-tree3" */ '../../lottie-for-UI/tree3.json')
          }
          speed={0.5}
          initialSegment={animationState ? [5, 55] : [0, 55]}
        />
      </div>
    </>
  );
};

export default BarGraph;
