// src/components/dragGraph/barGraph.jsx
import React, { useState, useEffect, useRef, useLayoutEffect, Suspense, useMemo } from 'react';
import { useGraph } from '../../context/graphContext.tsx';
import { useRelativePercentiles, avgWeightOf } from '../../utils/useRelativePercentiles.ts';
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
  const {
    data,
    loading,
    section,
    mySection,
    hasCompletedSurvey,
    myEntryId,
  } = useGraph();

  // Percentile helper (self-excluding for getForId)
  const { getForId } = useRelativePercentiles(data);

  const [animationState, setAnimationState] = useState(false);
  const [animateBars, setAnimateBars] = useState(false);
  const barRefs = useRef({});

  // Show "You" whenever your entry exists in the current dataset (matches DotGraph behavior)
  const includesMe = useMemo(
    () => Boolean(myEntryId && Array.isArray(data) && data.some(d => d?._id === myEntryId)),
    [data, myEntryId]
  );
  const canShowYou = Boolean(hasCompletedSurvey && myEntryId && includesMe);

  // Kick bar grow animation once data is ready
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setAnimateBars(true), 10);
      return () => clearTimeout(t);
    } else {
      setAnimateBars(false);
    }
  }, [loading, data]);

  // --- ABSOLUTE buckets for bar heights ---
  // score = avgWeight * 100 → 0..33 red, 34..60 yellow, 61..100 green
  const categories = useMemo(() => {
    const out = { red: 0, yellow: 0, green: 0 };
    for (const item of data) {
      const score = Math.floor((avgWeightOf(item) || 0) * 100);
      if (score <= 40) out.red++;
      else if (score <= 60) out.yellow++;
      else out.green++;
    }
    return out;
  }, [data]);

  // --- RELATIVE marker (“You”) ---
  // position by percentile vs the whole pool (UNADJUSTED, per your request)
  const youPercentile = useMemo(
    () => (canShowYou ? getForId(myEntryId) : 0),
    [canShowYou, getForId, myEntryId]
  );

  // choose bar for marker by your ABSOLUTE score bucket
  const youAbsoluteBar = useMemo(() => {
    if (!canShowYou) return null;
    const me = data.find(d => d?._id === myEntryId);
    const score = me ? Math.round((avgWeightOf(me) || 0) * 100) : 0;
    if (score <= 33) return 'red';
    if (score <= 60) return 'yellow';
    return 'green';
  }, [canShowYou, data, myEntryId]);

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
      // map percentile (0..100) to current bar height
      ref.style.setProperty('--user-percentage', `${(youPercentile / 100) * heightPercentage}%`);
    });
  }, [youPercentile, animateBars, canShowYou]);

  useEffect(() => {
    if (!animationState) {
      const t = setTimeout(() => setAnimationState(true), 200);
      return () => clearTimeout(t);
    }
  }, [animationState]);

  // UX guards
  if (!section) return <p className="graph-loading">Pick a section to begin.</p>;
  if (loading) return null;

  // render order: Green (left) → Yellow (middle) → Red (right)
  const orderedColors = ['green', 'yellow', 'red'];

  return (
    <>
      <div className="bar-graph-container">
        {orderedColors.map((color) => {
          const count = categories[color];
          const heightPercentage = (count / maxItems) * 100;

          // Show marker only in the bar that matches your ABSOLUTE bucket
          const showMarkerInThisBar = canShowYou && youAbsoluteBar === color;

          // We still need a height for the wrapper that clips the marker;
          // use percentile mapped into the bar's current fill height.
          const userPercentage = (youPercentile / 100) * heightPercentage;

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
                {showMarkerInThisBar && (
                  <div
                    className="percentage-section"
                  style={{
                    height: animateBars
                      ? `calc(${Math.min(userPercentage, heightPercentage)}%)`
                      : '0%',
                  }}
                  >
                    <div className="percentage-indicator">
                      <p>You</p>
                      <p>{youPercentile}%</p>
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
