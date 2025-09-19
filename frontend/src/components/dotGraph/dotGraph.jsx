import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';

import CompleteButton from '../completeButton.jsx';
import GamificationPersonalized from '../gamification/gamificationPersonalized';
import GamificationGeneral from '../gamification/gamificationGeneral';
import RingHalo from './ringHalo';

import { useGraph } from '../../context/graphContext.tsx';
import { useRealMobileViewport } from '../real-mobile.ts';
import { sampleStops, rgbString } from '../../utils/hooks.ts';
import { useRelativePercentiles, avgWeightOf } from '../../utils/useRelativePercentiles.ts';
import { useAbsoluteScore } from '../../utils/useAbsoluteScore.ts';

import useOrbit from './hooks/useOrbit.js';
import useDotPoints from './hooks/useDotPoints';
import useHoverBubble from './hooks/useHoverBubble';
import useObserverDelay from './hooks/useObserverDelay';

const nonlinearLerp = (a, b, t) => {
  const x = Math.max(0, Math.min(1, t));
  return a + (b - a) * (1 - Math.pow(1 - x, 5));
};

const DotGraph = ({ isDragging = false, data = [] }) => {
  const { myEntryId, observerMode, mode } = useGraph(); // ← read mode from context
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

  const wantsSkew =
    (isSmallScreen || isRealMobile) &&
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
      xOffsetPx: wantsSkew ? -96 : 0,
      yOffsetPx: wantsSkew ? 90 : 0,
    },
    bounds: { minRadius: isSmallScreen ? 2 : 20, maxRadius: 400 },
    dataCount: safeData.length,
  });

  // 0 = zoomed in, 1 = zoomed out (still used for tooltip offset ease)
  const zoomFactor = Math.max(0, Math.min(1, (radius - minRadius) / (maxRadius - minRadius)));

  // ADAPTIVE SPREAD
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
    getCountForId: getRelCountForId,
    getCountForValue: getRelCountForValue,
    getPoolSize,
  } = useRelativePercentiles(safeData);

  const { getForId: getAbsForId, getForValue: getAbsForValue } = useAbsoluteScore(safeData, { decimals: 0 });

  const myDisplayValue = useMemo(() => {
    if (!(showCompleteUI && myEntry)) return 0;
    return mode === 'relative' ? getRelForId(myEntry._id) : getAbsForId(myEntry._id);
  }, [showCompleteUI, myEntry, mode, getRelForId, getAbsForId]);

  const myCountBelow = useMemo(() => {
    if (!(showCompleteUI && myEntry) || mode !== 'relative') return 0;
    return getRelCountForId(myEntry._id);
  }, [showCompleteUI, myEntry, mode, getRelCountForId]);

  const myPoolSize = useMemo(() => {
    if (!(showCompleteUI && myEntry) || mode !== 'relative') return 0;
    return getPoolSize(myEntry._id);
  }, [showCompleteUI, myEntry, mode, getPoolSize]);

  const calcValueForAvg = (averageWeight) =>
    mode === 'relative' ? getRelForValue(averageWeight) : getAbsForValue(averageWeight);

  // hover tooltips use whichever metric the mode demands
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

  // --- Auto-dismiss tooltip after rotate, with grace + fade-out ---
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef(null);
  const fadeTimerRef = useRef(null);

  const clearCloseTimers = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };

  useEffect(() => {
    clearCloseTimers();
    setIsClosing(false);
  }, [hoveredDot?.dotId]);

  useEffect(() => {
    const onRotate = () => {
      if (!hoveredDot) return;
      if (closeTimerRef.current) return;
      closeTimerRef.current = setTimeout(() => {
        setIsClosing(true);
        fadeTimerRef.current = setTimeout(() => {
          onHoverEnd();
          setIsClosing(false);
          clearCloseTimers();
        }, 180);
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
    : nonlinearLerp(offsetBase, offsetBase * 1.35, zoomFactor);

  return (
    <>
      {showCompleteUI && (
        <Html zIndexRange={[2, 24]} style={{ pointerEvents: 'none' }}>
          <div
            className="z-index-respective"
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              alignItems: 'center',
              height: '100vh',
              pointerEvents: 'none',
            }}
          >
            <CompleteButton />
          </div>
        </Html>
      )}

      <group ref={groupRef}>
        {points.map((point) => {
          const suppressHover = !!(myEntry && point._id === personalizedEntryId && showCompleteUI);
          return (
            <mesh
              key={
                point._id ??
                `${point.position[0]}-${point.position[1]}-${point.position[2]}`
              }
              position={point.position}
              onPointerOver={(e) => {
                e.stopPropagation();
                if (!suppressHover) onHoverStart(point, e);
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                if (!suppressHover) onHoverEnd();
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!suppressHover) onHoverStart(point, e);
              }}
            >
              <sphereGeometry args={[1.4, 48, 48]} />
              <meshStandardMaterial color={point.color} />
            </mesh>
          );
        })}

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
              style={{ pointerEvents: 'none', '--offset-px': `${offsetPx}px` }}
            >
              <div>
                <GamificationPersonalized
                  userData={myEntry}
                  percentage={myDisplayValue}    // (kept for backwards-compat)
                  count={myCountBelow}            // NEW: how many you’re ahead of
                  poolSize={myPoolSize}           // NEW: pool size (self-excluded)
                  color={myPoint.color}
                  mode={mode}
                  onOpenChange={setPersonalOpen}
                />
              </div>
            </Html>
          </>
        )}

        {hoveredDot &&
          (() => {
            const hoveredData = points.find((d) => d._id === hoveredDot.dotId);
            if (!hoveredData) return null;

            // compute count/pool for relative mode
            let count = 0;
            let pool = 0;
            if (mode === 'relative') {
              const dataObj = safeData.find(d => d._id === hoveredDot.dotId);
              const avg = dataObj ? avgWeightOf(dataObj) : 0.5;
              count = getRelCountForValue(avg);     // includes ties policy
              pool = getPoolSize(undefined);        // whole pool (don’t exclude hovered)
            }

            return (
              <Html
                position={hoveredData.position}
                center
                zIndexRange={[120, 180]}
                style={{
                  pointerEvents: 'none',
                  '--offset-px': `${offsetPx}px`,
                  opacity: isClosing ? 0 : 1,
                  transition: 'opacity 180ms ease',
                }}
                className={viewportClass}
              >
                <div>
                  <GamificationGeneral
                    dotId={hoveredDot.dotId}
                    percentage={hoveredDot.percentage} 
                    count={count}                      
                    poolSize={pool}                     
                    color={hoveredData.color}
                    mode={mode}
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
