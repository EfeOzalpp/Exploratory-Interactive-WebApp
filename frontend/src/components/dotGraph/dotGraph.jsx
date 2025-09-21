// src/components/dotGraph/dotGraph.jsx
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Html, Line } from '@react-three/drei';

import CompleteButton from '../completeButton.jsx';
import GamificationPersonalized from '../gamification/gamificationPersonalized';
import GamificationGeneral from '../gamification/gamificationGeneral';
import RingHalo, { RingHaloMini } from './ringHalo';

import { useGraph } from '../../context/graphContext.tsx';
import { useRealMobileViewport } from '../real-mobile.ts';
import { sampleStops, rgbString } from '../../utils/hooks.ts';
import { useRelativePercentiles, avgWeightOf } from '../../utils/useRelativePercentiles.ts';
import { useAbsoluteScore } from '../../utils/useAbsoluteScore.ts';

// orchestrator + hooks
import useOrbit from './hooks/useOrbit';
import useDotPoints from './hooks/useDotPoints';
import useHoverBubble from './hooks/useHoverBubble';
import useObserverDelay from './hooks/useObserverDelay';

// tie-aware ranking utilities (shared source of truth)
import { getTieStats, classifyPosition } from '../gamification/rankLogic';

// ---------- utils ----------
const nonlinearLerp = (a, b, t) => {
  const x = Math.max(0, Math.min(1, t));
  return a + (b - a) * (1 - Math.pow(1 - x, 5));
};

const EPS = 1e-6;

const DotGraph = ({ isDragging = false, data = [] }) => {
  const { myEntryId, observerMode, mode, section } = useGraph();
  const safeData = Array.isArray(data) ? data : [];
  const showCompleteUI = useObserverDelay(observerMode, 2000);

  const personalizedEntryId =
    myEntryId || (typeof window !== 'undefined' ? sessionStorage.getItem('gp.myEntryId') : null);

  const [personalOpen, setPersonalOpen] = useState(true);
  const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const isRealMobile = useRealMobileViewport();
  const isSmallScreen = width < 768;
  const isTabletLike = width >= 768 && width <= 1024;
  const useDesktopLayout = !(isSmallScreen || isRealMobile || isTabletLike);

  const hasPersonalized = useMemo(
    () => !!personalizedEntryId && safeData.some(d => d._id === personalizedEntryId),
    [personalizedEntryId, safeData]
  );

  // Only skew under 768px
  const wantsSkew =
    isSmallScreen &&
    !observerMode &&
    hasPersonalized &&
    personalOpen;

  const {
    groupRef,
    radius,
    isPinchingRef,
    isTouchRotatingRef,
    minRadius,
    maxRadius,
    tooltipOffsetPx,
  } = useOrbit({
    isDragging,
    layout: {
      useDesktopLayout,
      isSmallScreen,
      isTabletLike,
      xOffset: 0,
      yOffset: 0,
      xOffsetPx: wantsSkew ? -168 : 0,
      yOffsetPx: wantsSkew ? 24 : 0,
    },
    bounds: { minRadius: isSmallScreen ? 2 : 20, maxRadius: 400 },
    dataCount: safeData.length,
  });

  // adaptive spread
  const spread = useMemo(() => {
    const n = safeData.length;
    const MIN_SPREAD = 28;
    const MAX_SPREAD = 220;
    const REF_N = 50;
    const CURVE = 0.5;
    const t = n <= 1 ? 0 : Math.min(1, Math.pow(n / REF_N, CURVE));
    return MIN_SPREAD + (MAX_SPREAD - MIN_SPREAD) * t;
  }, [safeData.length]);

  const colorForAverage = useMemo(
    () => (avg /* 0..1 */) => rgbString(sampleStops(avg)),
    []
  );

  const points = useDotPoints(safeData, {
    spread,
    minDistance: 2,
    seed: 1337,
    relaxPasses: 1,
    relaxStrength: 0.25,
    centerBias: 0.35,
    colorForAverage,
    personalizedEntryId,
    showPersonalized: showCompleteUI && hasPersonalized,
  });

  // maps & helpers
  const posById = useMemo(() => new Map(points.map(p => [p._id, p.position])), [points]);
  const colorById = useMemo(() => new Map(points.map(p => [p._id, p.color])), [points]);

  const myPoint = useMemo(
    () => points.find(p => p._id === personalizedEntryId),
    [points, personalizedEntryId]
  );
  const myEntry = useMemo(
    () => safeData.find(e => e._id === personalizedEntryId),
    [safeData, personalizedEntryId]
  );

  // ---- Metrics (relative vs absolute) ----
  const {
    getForId: getRelForId,
    getForValue: getRelForValue,
  } = useRelativePercentiles(safeData);

  const { getForId: getAbsForId, getForValue: getAbsForValue } = useAbsoluteScore(safeData, { decimals: 0 });

  const myDisplayValue = useMemo(() => {
    if (!(showCompleteUI && myEntry)) return 0;
    return mode === 'relative' ? getRelForId(myEntry._id) : getAbsForId(myEntry._id);
  }, [showCompleteUI, myEntry, mode, getRelForId, getAbsForId]);

  const getForValueSafe = (fn, v) => {
    try { return fn(v); } catch { return 0; }
  };
  const calcValueForAvg = (averageWeight) =>
    mode === 'relative' ? getForValueSafe(getRelForValue, averageWeight) : getForValueSafe(getAbsForValue, averageWeight);

  // Build absolute score map for equality checks in ABSOLUTE mode
  const absScoreById = useMemo(() => {
    // getAbsForId returns a 0..100 integer (decimals: 0)
    const m = new Map();
    for (const d of safeData) m.set(d._id, getAbsForId(d._id));
    return m;
  }, [safeData, getAbsForId]);

  // hover tooltips
  const {
    hoveredDot,
    viewportClass,
    onHoverStart,
    onHoverEnd,
  } = useHoverBubble({
    useDesktopLayout,
    isDragging,
    isPinchingRef,
    isTouchRotatingRef,
    calcPercentForAvg: calcValueForAvg,
  });

  // ----- global bottom→top chain (by average/relative value)
  const rankChainIds = useMemo(() => {
    if (points.length < 2) return [];
    const entries = safeData.map(d => ({ id: d._id, avg: avgWeightOf(d) }));
    entries.sort((a, b) => a.avg - b.avg);
    const uniqueIds = [];
    for (let i = 0; i < entries.length; i++) {
      if (i === 0 || Math.abs(entries[i].avg - entries[i - 1].avg) > EPS) uniqueIds.push(entries[i].id);
    }
    return uniqueIds;
  }, [points, safeData]);

  const rankChainPoints = useMemo(
    () => rankChainIds.map(id => posById.get(id)).filter(Boolean),
    [rankChainIds, posById]
  );

  const rankChainIdSet = useMemo(() => new Set(rankChainIds), [rankChainIds]);

  // --- Tie buckets (ids grouped by approx equal avg); keep only groups with size > 1
  const tieBuckets = useMemo(() => {
    const b = new Map(); // key -> ids[]
    if (!safeData.length) return b;
    for (const d of safeData) {
      const a = avgWeightOf(d);
      const key = Math.round(a / EPS) * EPS;
      let arr = b.get(key);
      if (!arr) { arr = []; b.set(key, arr); }
      arr.push(d._id);
    }
    for (const [k, arr] of b) if (arr.length <= 1) b.delete(k);
    return b;
  }, [safeData]);

  // Selected tie group (by bucket key)
  const [selectedTieKey, setSelectedTieKey] = useState(null);

  // Reset selection when mode changes
  useEffect(() => {
    setSelectedTieKey(null);
  }, [mode]);

  // Build line points for the selected tie group (sorted around centroid)
  const selectedTieLinePoints = useMemo(() => {
    if (!selectedTieKey || !tieBuckets.has(selectedTieKey)) return [];
    const ids = tieBuckets.get(selectedTieKey).filter(id => posById.has(id));
    if (ids.length < 2) return [];
    const pts = ids.map(id => posById.get(id));
    let cx = 0, cy = 0, cz = 0;
    for (const p of pts) { cx += p[0]; cy += p[1]; cz += p[2]; }
    cx /= pts.length; cy /= pts.length; cz /= pts.length;
    const sorted = pts.slice().sort((a,b) => {
      const aa = Math.atan2(a[2]-cz, a[0]-cx);
      const bb = Math.atan2(b[2]-cz, b[0]-cx);
      return aa - bb;
    });
    return sorted;
  }, [selectedTieKey, tieBuckets, posById]);

  // Helper: get tie key for a dot id (or null)
  const getTieKeyForId = (id) => {
    const entry = safeData.find(d => d._id === id);
    if (!entry) return null;
    const a = avgWeightOf(entry);
    const key = Math.round(a / EPS) * EPS;
    const arr = tieBuckets.get(key);
    return arr && arr.length > 1 ? key : null;
  };

  // ABSOLUTE: hovered equals set (highlight hovered + all with same absolute score)
  const hoveredAbsEqualSet = useMemo(() => {
    if (mode !== 'absolute' || !hoveredDot) return new Set();
    const score = absScoreById.get(hoveredDot.dotId);
    if (score == null) return new Set();
    const ids = safeData.filter(d => absScoreById.get(d._id) === score).map(d => d._id);
    return new Set(ids);
  }, [mode, hoveredDot, absScoreById, safeData]);

  // --- Auto-dismiss tooltip after rotate
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef(null);
  const fadeTimerRef = useRef(null);

  const clearCloseTimers = () => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }
  };

  useEffect(() => { clearCloseTimers(); setIsClosing(false); }, [hoveredDot?.dotId]);

  useEffect(() => {
    const onRotate = () => {
      if (!hoveredDot) return;
      if (closeTimerRef.current) return;
      closeTimerRef.current = setTimeout(() => {
        setIsClosing(true);
        fadeTimerRef.current = setTimeout(() => { onHoverEnd(); setIsClosing(false); clearCloseTimers(); }, 180);
      }, 2000);
    };
    window.addEventListener('gp:orbit-rot', onRotate);
    return () => window.removeEventListener('gp:orbit-rot', onRotate);
  }, [hoveredDot, onHoverEnd]);

  const isPortrait =
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false;
  const offsetBase = isPortrait ? 160 : 120;
  const offsetPx = Number.isFinite(tooltipOffsetPx)
    ? tooltipOffsetPx
    : nonlinearLerp(
        offsetBase,
        offsetBase * 1.35,
        Math.max(0, Math.min(1, (radius - minRadius) / (maxRadius - minRadius)))
      );

  // -------- tie-aware stats (shared for both panels) --------
  const myStats = myEntry
    ? getTieStats({ data: safeData, targetId: myEntry._id })
    : { below: 0, equal: 0, above: 0, totalOthers: 0 };
  const myClass  = classifyPosition(myStats);

  const hoveredStats = useMemo(() => {
    if (!hoveredDot) return { below: 0, equal: 0, above: 0, totalOthers: 0 };
    return getTieStats({ data: safeData, targetId: hoveredDot.dotId });
  }, [hoveredDot, safeData]);
  const hoveredClass = classifyPosition(hoveredStats);

  return (
    <>
      {showCompleteUI && (
        <Html zIndexRange={[2, 24]} style={{ pointerEvents: 'none' }}>
          <div
            className="z-index-respective"
            style={{ display:'flex', justifyContent:'flex-start', alignItems:'center', height:'100vh', pointerEvents:'none' }}
          >
            <CompleteButton />
          </div>
        </Html>
      )}

      <group ref={groupRef}>
        {points.map((point) => {
          const suppressHover = !!(myEntry && point._id === personalizedEntryId && showCompleteUI);

          // RELATIVE: is this point in the selected tie group?
          const tieKey = getTieKeyForId(point._id);
          const isInSelectedTie = mode === 'relative' && selectedTieKey && tieKey === selectedTieKey;

          // RELATIVE: if NO selection, should we show rank-chain halos on every node in chain?
          const showRankChainHalos = mode === 'relative' && !selectedTieKey && rankChainIdSet.has(point._id);

          // ABSOLUTE: when hovering, halo all equal-score points (including hovered)
          const showAbsEqualHoverHalo = mode === 'absolute' && hoveredAbsEqualSet.has(point._id);

          // Determine if this point gets a halo (priority: selected-tie > abs-equal-hover > rank-chain)
          const showHalo = isInSelectedTie || showAbsEqualHoverHalo || showRankChainHalos;

          return (
            <group
              key={point._id ?? `${point.position[0]}-${point.position[1]}-${point.position[2]}`}
              position={point.position}
            >
              {showHalo && (
                <RingHaloMini
                  color={colorById.get(point._id) || '#fff'}
                  baseRadius={1.4}
                  active
                />
              )}

              <mesh
                onPointerOver={(e) => { e.stopPropagation(); if (!suppressHover) onHoverStart(point, e); }}
                onPointerOut={(e) =>  { e.stopPropagation(); if (!suppressHover) onHoverEnd(); }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!suppressHover) onHoverStart(point, e);
                  if (mode !== 'relative') return;
                  const key = getTieKeyForId(point._id);
                  if (key) {
                    setSelectedTieKey(prev => (prev === key ? null : key)); // toggle selection
                  } else {
                    setSelectedTieKey(null);
                  }
                }}
              >
                <sphereGeometry args={[1.4, 48, 48]} />
                <meshStandardMaterial color={point.color} />
              </mesh>
            </group>
          );
        })}

        {/* Lines:
            - RELATIVE:
                - If a tie group is selected → show ONLY the tie polyline + halos (rank chain hidden)
                - Else → show the global bottom→top chain + halos on every chain node
            - ABSOLUTE: no lines
        */}
        {mode === 'relative' && selectedTieKey && selectedTieLinePoints.length >= 2 && (
          <Line
            points={selectedTieLinePoints}
            color="#a3a3a3"
            lineWidth={1.5}
            dashed={false}
            toneMapped={false}
            transparent
            opacity={0.85}
          />
        )}
        {mode === 'relative' && !selectedTieKey && rankChainPoints.length >= 2 && (
          <Line
            points={rankChainPoints}
            color="#7b7b7b"
            lineWidth={1.5}
            dashed={false}
            toneMapped={false}
            transparent
            opacity={0.6}
          />
        )}

        {/* Personalized highlight */}
        {showCompleteUI && myPoint && myEntry && (
          <>
            <group position={myPoint.position}>
              <RingHalo color={myPoint.color} baseRadius={1.4} active bloomLayer={1} />
              <mesh>
                <sphereGeometry args={[1.4, 48, 48]} />
                <meshStandardMaterial color={myPoint.color} />
              </mesh>
            </group>

            <Html
              position={myPoint.position}
              center
              zIndexRange={[110, 130]}
              style={{ pointerEvents:'none', '--offset-px': `${offsetPx}px` }}
            >
              <div>
                <GamificationPersonalized
                  userData={myEntry}
                  percentage={myDisplayValue}
                  color={myPoint.color}
                  mode={mode}
                  selectedSectionId={section}
                  belowCountStrict={myStats.below}
                  equalCount={myStats.equal}
                  aboveCountStrict={myStats.above}
                  positionClass={myClass.position}
                  tieContext={myClass.tieContext}
                  onOpenChange={setPersonalOpen}
                />
              </div>
            </Html>
          </>
        )}

        {/* Hover tooltip (General) */}
        {hoveredDot && (() => {
          const hoveredData = points.find((d) => d._id === hoveredDot.dotId);
          if (!hoveredData) return null;

          return (
            <Html
              position={hoveredData.position}
              center
              zIndexRange={[120, 180]}
              style={{
                pointerEvents:'none',
                '--offset-px': `${offsetPx}px`,
                opacity: isClosing ? 0 : 1,
                transition:'opacity 180ms ease'
              }}
              className={viewportClass}
            >
              <div>
                <GamificationGeneral
                  dotId={hoveredDot.dotId}
                  percentage={hoveredDot.percentage}
                  color={hoveredData.color}
                  mode={mode}
                  belowCountStrict={hoveredStats.below}
                  equalCount={hoveredStats.equal}
                  aboveCountStrict={hoveredStats.above}
                  positionClass={hoveredClass.position}
                  tieContext={hoveredClass.tieContext}
                />
              </div>
            </Html>
          );
        })()}
      </group>
    </>
  );
};

export default DotGraph;
