// ─────────────────────────────────────────────────────────────
// src/graph-runtime/bargraph/BarGraph.tsx
// BarGraph visualization (single-file, orchestrator-style)
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect, Suspense } from 'react';

import { useAppState } from '../../app-context/appStateContext.tsx';
import { useRelativeScores, avgWeightOf } from '../../utils-hooks/useRelativeScore.ts';

import EmptyStateArt from './EmptyArt.tsx';

import '../../static-assets/styles/graph.css';

const Lottie = React.lazy(() => import(/* webpackChunkName: "lottie-react" */ 'lottie-react'));

type TreeIconProps = {
  jsonLoader: () => Promise<any>;
  speed?: number;
  initialSegment?: [number, number];
};

function TreeIcon({ jsonLoader, speed = 0.3, initialSegment = [5, 55] }: TreeIconProps) {
  const ref = useRef<any>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    jsonLoader().then((mod) => {
      if (alive) setData(mod?.default ?? mod);
    });
    return () => {
      alive = false;
    };
  }, [jsonLoader]);

  useEffect(() => {
    if (!ref.current) return;
    const t = window.setTimeout(() => ref.current?.setSpeed?.(speed), 50);
    return () => window.clearTimeout(t);
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

type BarColor = 'red' | 'yellow' | 'green';

type Categories = Record<BarColor, number>;

const orderedColors: BarColor[] = ['green', 'yellow', 'red'];

export default function BarGraph() {
  const { data, loading, section, hasCompletedSurvey, myEntryId, darkMode } = useAppState() as any;

  const safeData: any[] = Array.isArray(data) ? data : [];
  const { getForId } = useRelativeScores(safeData);

  const [animationState, setAnimationState] = useState(false);
  const [animateBars, setAnimateBars] = useState(false);

  const barRefs = useRef<Partial<Record<BarColor, HTMLDivElement | null>>>({});

  const includesMe = useMemo(
    () => Boolean(myEntryId && safeData.some((d) => d?._id === myEntryId)),
    [safeData, myEntryId]
  );

  const canShowYou = Boolean(hasCompletedSurvey && myEntryId && includesMe);

  useEffect(() => {
    if (!loading) {
      const t = window.setTimeout(() => setAnimateBars(true), 10);
      return () => window.clearTimeout(t);
    }
    setAnimateBars(false);
  }, [loading, safeData]);

  const categories: Categories = useMemo(() => {
    const out: Categories = { red: 0, yellow: 0, green: 0 };
    for (const item of safeData) {
      const score = Math.floor((avgWeightOf(item) || 0) * 100);
      if (score <= 40) out.red += 1;
      else if (score <= 60) out.yellow += 1;
      else out.green += 1;
    }
    return out;
  }, [safeData]);

  const totalCount = safeData.length;

  const rawYouPercentile = useMemo(() => (canShowYou ? getForId(myEntryId) : 0), [
    canShowYou,
    getForId,
    myEntryId,
  ]);

  // If you're the only respondent, show 100% instead of 0%
  const youPercentile = useMemo(
    () => (canShowYou && totalCount === 1 ? 100 : rawYouPercentile),
    [canShowYou, totalCount, rawYouPercentile]
  );

  const youAbsoluteBar: BarColor | null = useMemo(() => {
    if (!canShowYou) return null;
    const me = safeData.find((d) => d?._id === myEntryId);
    const score = me ? Math.round((avgWeightOf(me) || 0) * 100) : 0;
    if (score <= 33) return 'red';
    if (score <= 60) return 'yellow';
    return 'green';
  }, [canShowYou, safeData, myEntryId]);

  const maxItems = Math.max(categories.green, categories.yellow, categories.red) + 15;

  const [normalizeDivisor, setNormalizeDivisor] = useState(100 / 78);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mqSmall = window.matchMedia('(max-width: 768px)');
    const mqMedium = window.matchMedia('(min-width: 769px) and (max-width: 1024px)');

    const apply = () => {
      if (mqSmall.matches) setNormalizeDivisor(100 / 71);
      else if (mqMedium.matches) setNormalizeDivisor(100 / 80);
      else setNormalizeDivisor(100 / 78);
    };

    apply();

    const listeners = [mqSmall, mqMedium] as const;

    listeners.forEach((mq) =>
      mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply)
    );
    window.addEventListener('resize', apply);

    return () => {
      listeners.forEach((mq) =>
        mq.removeEventListener ? mq.removeEventListener('change', apply) : mq.removeListener(apply)
      );
      window.removeEventListener('resize', apply);
    };
  }, []);

  useLayoutEffect(() => {
    (Object.entries(barRefs.current) as Array<[string, HTMLDivElement | null | undefined]>).forEach(
      ([_, ref]) => {
        if (!ref) return;

        if (!canShowYou) {
          ref.style.setProperty('--user-percentage', '0%');
          return;
        }

        const parentH = ref.parentElement?.offsetHeight || 1;
        const heightPercentage = (ref.offsetHeight / parentH) * 100;
        const raw = (youPercentile / 100) * heightPercentage;
        const normalized = raw / normalizeDivisor;

        ref.style.setProperty('--user-percentage', `${normalized}%`);
      }
    );
  }, [youPercentile, animateBars, canShowYou, normalizeDivisor]);

  useEffect(() => {
    if (animationState) return;
    const t = window.setTimeout(() => setAnimationState(true), 200);
    return () => window.clearTimeout(t);
  }, [animationState]);

  if (!section) return <p className="graph-loading">Pick a section to begin.</p>;
  if (loading) return null;

  const noData = safeData.length === 0;
  if (noData) {
    return (
      <div className="empty-center">
        <div className={`empty-card ${darkMode ? 'is-dark' : 'is-light'}`}>
          <EmptyStateArt className="empty-icon floaty" />
          <h3>Nothing Here...</h3>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bar-graph-container">
        {orderedColors.map((color) => {
          const count = categories[color];
          const heightPercentage = (count / maxItems) * 100;

          const showMarkerInThisBar = canShowYou && youAbsoluteBar === color;

          const userPercentage = (youPercentile / 100) * heightPercentage;
          const normalizedUserPercentage = userPercentage / normalizeDivisor;

          // Drive label color from context.darkMode (no edge-cue dependency)
          const labelColor = darkMode ? 'rgba(249, 249, 249, 0.85)' : 'rgba(0,0,0,0.85)';

          return (
            <div
              className="bar-graph-bar"
              key={color}
              ref={(el) => {
                barRefs.current[color] = el;
              }}
            >
              <span
                className="bar-graph-label"
                style={{
                  color: labelColor,
                  transition: 'color 200ms ease',
                }}
              >
                <p>{count} People</p>
              </span>

              <div className="bar-graph-divider">
                {showMarkerInThisBar && (
                  <div
                    className="percentage-section"
                    style={{
                      height:
                        animationState && animateBars
                          ? `calc(${Math.min(normalizedUserPercentage, heightPercentage)}%)`
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

      <div className="bar-graph-icons">
        <TreeIcon
          jsonLoader={() =>
            import(
              /* webpackChunkName:"lottie-tree1" */ '../../static-assets/lottie/tree1.json'
            )
          }
          speed={0.3}
          initialSegment={animationState ? [5, 55] : [0, 55]}
        />
        <TreeIcon
          jsonLoader={() =>
            import(
              /* webpackChunkName:"lottie-tree2" */ '../../static-assets/lottie/tree2.json'
            )
          }
          speed={0.2}
          initialSegment={animationState ? [5, 55] : [0, 55]}
        />
        <TreeIcon
          jsonLoader={() =>
            import(
              /* webpackChunkName:"lottie-tree3" */ '../../static-assets/lottie/tree3.json'
            )
          }
          speed={0.5}
          initialSegment={animationState ? [5, 55] : [0, 55]}
        />
      </div>
    </>
  );
}
