// src/components/dotGraph/DotGraph.jsx
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';

import CompleteButton from '../completeButton.jsx';
import GamificationPersonalized from '../gamification/gamificationPersonalized';
import GamificationGeneral from '../gamification/gamificationGeneral';
import RingHalo from './ringHalo';

import { useGraph } from '../../context/graphContext.tsx';
import { useRealMobileViewport } from '../real-mobile.ts';
import { sampleStops, rgbString } from '../../utils/hooks.ts';

import useOrbit from './hooks/useOrbit.js';
import useDotPoints from './hooks/useDotPoints';
import useHoverBubble from './hooks/useHoverBubble';
import useObserverDelay from './hooks/useObserverDelay';

const nonlinearLerp = (a, b, t) => {
  const x = Math.max(0, Math.min(1, t));
  return a + (b - a) * (1 - Math.pow(1 - x, 5));
};

const DotGraph = ({ isDragging = false, data = [] }) => {
  const { myEntryId, observerMode } = useGraph();
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

  const wantsSkew =
    (isSmallScreen || isRealMobile) &&
    !observerMode &&
    !!personalizedEntryId &&
    safeData.some(d => d._id === personalizedEntryId) &&
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
      xOffsetPx: wantsSkew ? -96 : 0,   // ~72px to the left
      yOffsetPx: wantsSkew ?  90 : 0,   // small downward nudge; set 0 if you don’t want it
    },
    bounds: { minRadius: isSmallScreen ? 2 : 20, maxRadius: 400 },
    dataCount: safeData.length,
  });

  // 0 = zoomed in, 1 = zoomed out (still used for tooltip offset ease)
  const zoomFactor = Math.max(0, Math.min(1, (radius - minRadius) / (maxRadius - minRadius)));

  // 🔑 ADAPTIVE SPREAD: few dots = tight; many dots = wider
  const spread = useMemo(() => {
    const n = safeData.length;

    // TWEAK THESE KNOBS:
    const MIN_SPREAD = 28;   // how tight 1–3 dots feel (smaller = tighter)
    const MAX_SPREAD = 220;  // how wide many dots feel (bigger = more spread)
    const REF_N      = 50;   // n where you’re ~near MAX_SPREAD
    const CURVE      = 0.5;  // 0.5 = sqrt (gentle), 1 = linear, 0.33 ~ cbrt

    const t = n <= 1 ? 0 : Math.min(1, Math.pow(n / REF_N, CURVE));
    return MIN_SPREAD + (MAX_SPREAD - MIN_SPREAD) * t;
  }, [safeData.length]);

  const colorForAverage = useMemo(
    () => (avg /* 0..1 */) => rgbString(sampleStops(1 - avg)),
    []
  );

  const points = useDotPoints(safeData, {
    spread,                // ← use the adaptive spread
    minDistance: 2,        // spacing guard (raise to separate more)
    seed: 1337,            // optional: stable layout
    relaxPasses: 1,        // slight de-jitter
    relaxStrength: 0.25,
    centerBias: 0.35,

    colorForAverage,
    personalizedEntryId,
    showPersonalized:
      showCompleteUI && !!personalizedEntryId && safeData.some(d => d._id === personalizedEntryId),
  });

  const myPoint = useMemo(
    () => points.find(p => p._id === personalizedEntryId),
    [points, personalizedEntryId]
  );
  const myEntry = useMemo(
    () => safeData.find(e => e._id === personalizedEntryId),
    [safeData, personalizedEntryId]
  );

  const personalizedPct = useMemo(() => {
    if (!(showCompleteUI && myEntry)) return 0;
    const latestVals = Object.values(myEntry.weights || {});
    const latestAvg = latestVals.length
      ? latestVals.reduce((s, w) => s + w, 0) / latestVals.length
      : 0.5;
    const higher = safeData.filter(entry => {
      const v = Object.values(entry.weights || {});
      const avg = v.length ? v.reduce((s, w) => s + w, 0) / v.length : 0.5;
      return avg > latestAvg;
    });
    return safeData.length ? Math.round((higher.length / safeData.length) * 100) : 0;
  }, [showCompleteUI, myEntry, safeData]);

  const calcPercentForAvg = (averageWeight) => {
    if (!points.length) return 0;
    const higher = points.filter((p) => p.averageWeight > averageWeight);
    return Math.round((higher.length / points.length) * 100);
  };

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
    calcPercentForAvg,
  });

    // --- Auto-dismiss tooltip after rotate, with grace + fade-out ---
    const [isClosing, setIsClosing] = useState(false);
    const closeTimerRef = useRef(null);
    const fadeTimerRef = useRef(null);
  
    const clearCloseTimers = () => {
      if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
      if (fadeTimerRef.current)  { clearTimeout(fadeTimerRef.current);  fadeTimerRef.current  = null; }
    };
  
    // Reset pending timers and closing state when the hovered item changes (open/new)
    useEffect(() => {
      clearCloseTimers();
      setIsClosing(false);
    }, [hoveredDot?.dotId]);
  
    // Listen for rotation while a tooltip is open
    useEffect(() => {
      const onRotate = () => {
        if (!hoveredDot) return;
        // Already scheduled? keep the first grace window
       if (closeTimerRef.current) return;
        // 2s grace, then 180ms fade, then unmount
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

  const isPortrait = typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false;
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
              key={point._id ?? `${point.position[0]}-${point.position[1]}-${point.position[2]}`}
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
                  percentage={personalizedPct}
                  color={myPoint.color}
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
            return (
              <Html
                position={hoveredData.position}
                center
                zIndexRange={[120, 180]}
                style={{
                  pointerEvents: 'none',
                  '--offset-px': `${offsetPx}px`,
                  opacity: isClosing ? 0 : 1,
                  transition: 'opacity 180ms ease'
                }}
                className={viewportClass}
              >
                <div>
                  <GamificationGeneral
                    dotId={hoveredDot.dotId}
                    percentage={hoveredDot.percentage}
                    color={hoveredData.color}
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
