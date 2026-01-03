// ─────────────────────────────────────────────────────────────
// src/components/dotGraph/DotGraph.tsx
// DotGraph scene composition + interaction wiring
// ─────────────────────────────────────────────────────────────

import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { Html, Line } from '@react-three/drei';

import CompleteButton from '../../weighted-survey/CompleteButton.jsx';

import GamificationPersonalized from '../gamification/GamificationPersonalized.jsx';
import GamificationGeneral from '../gamification/GamificationGeneral.jsx';

import { useAppState } from '../../app-context/appStateContext.tsx';

import { useRealMobileViewport } from '../../utils-hooks/real-mobile.ts';
import { sampleStops, rgbString } from '../../utils-hooks/hooks.ts';
import { useRelativePercentiles, avgWeightOf } from '../../utils-hooks/useRelativePercentiles.ts';
import { useAbsoluteScore } from '../../utils-hooks/useAbsoluteScore.ts';

// DotGraph internals (feature-owned) — use public surface
import { useOrbitController } from './event-handlers/index.ts';
import useDotPoints from './hooks/useDotPoints.ts';
import useHoverBubble from './hooks/useHoverBubble.ts';
import useObserverDelay from './hooks/useObserverDelay.ts';

import { getTieStats, classifyPosition } from '../gamification/rankLogic.js';

import {
  SpriteShape,
  prewarmSpriteTextures,
  useTextureQueueProgress,
} from '../sprites/entry.ts';

import { shapeForAvg } from '../sprites/selection/shapeForAvg.ts';
import { FOOTPRINTS as SHAPE_FOOTPRINT } from '../sprites/selection/footprints.ts';

import { nonlinearLerp, boostColor } from './utils/colorBoost.ts';
import { ROLE, normSection, deriveRoleFromSectionId, allowPersonalInSection } from './dotgraph.scoping.ts';
import useObserverSpotlight from './hooks/useObserverSpotlight.ts';

// Minimal props typing (tighten later)
type DotGraphProps = {
  isDragging?: boolean;
  data?: any[];
};

const BLEED_FRAC: Record<string, { top: number; right: number; bottom: number; left: number }> = {
  trees: { top: 0.28, right: 0.0, bottom: 0.0, left: 0.0 },
  clouds: { top: 0, right: 0, bottom: 0, left: 0 },
  bus: { top: 0, right: 0, bottom: 0, left: 0 },
  snow: { top: 0, right: 0, bottom: 0, left: 0 },
  house: { top: 0, right: 0, bottom: 0, left: 0 },
  power: { top: 0, right: 0, bottom: 0, left: 0 },
  sun: { top: 0, right: 0, bottom: 0, left: 0 },
  villa: { top: 0, right: 0, bottom: 0, left: 0 },
  car: { top: 0, right: 0, bottom: 0, left: 0 },
  sea: { top: 0, right: 0, bottom: 0, left: 0 },
  carFactory: { top: 0, right: 0, bottom: 0, left: 0 },
};

const loaderCardStyle: React.CSSProperties = {
  pointerEvents: 'none',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  color: 'gray',
  borderRadius: 6,
  padding: '24px 16px',
  letterSpacing: '0.2px',
  whiteSpace: 'nowrap',
};

export default function DotGraph({ isDragging = false, data = [] }: DotGraphProps) {
  const { myEntryId, mySection, observerMode, mode, section } = useAppState() as any;

  const safeData: any[] = Array.isArray(data) ? data : [];
  const showCompleteUI = useObserverDelay(observerMode, 2000);

  const personalizedEntryId: string | null =
    myEntryId || (typeof window !== 'undefined' ? sessionStorage.getItem('gp.myEntryId') : null);

  const [personalOpen, setPersonalOpen] = useState(true);

  const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const isRealMobile = useRealMobileViewport();
  const isSmallScreen = width < 768;
  const isTabletLike = width >= 768 && width <= 1024;
  const useDesktopLayout = !(isSmallScreen || isRealMobile || isTabletLike);

  const hasPersonalizedInDataset = useMemo(
    () => !!personalizedEntryId && safeData.some((d) => d?._id === personalizedEntryId),
    [personalizedEntryId, safeData]
  );

  // ───────────────────────────────────────────────────────────
  // First-render safe identity + strict role derivation
  // ───────────────────────────────────────────────────────────
  const effectiveMySection = useMemo(() => {
    if (mySection && mySection !== '') return mySection;
    if (typeof window !== 'undefined') {
      const s = sessionStorage.getItem('gp.mySection');
      if (s && s !== '') return s;
    }
    return '';
  }, [mySection]);

  const viewerRole = useMemo(
    () => deriveRoleFromSectionId(effectiveMySection),
    [effectiveMySection]
  );

  const shouldShowPersonalized = useMemo(() => {
    const viewing =
      section ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('gp.viewingSection') : null) ||
      'all';

    const ok = allowPersonalInSection(viewerRole, effectiveMySection, viewing);

    // HARD GUARD: visitors only in Everyone & Visitors
    if (viewerRole === ROLE.VISITOR) {
      const v = normSection(viewing);
      return v === 'all' || v === 'visitor';
    }
    return ok;
  }, [viewerRole, effectiveMySection, section]);

  // Only skew under 768px and when we're actually showing the personalized card here
  const wantsSkew =
    isSmallScreen &&
    !observerMode &&
    hasPersonalizedInDataset &&
    personalOpen &&
    shouldShowPersonalized;

  const {
    groupRef,
    radius,
    isPinchingRef,
    isTouchRotatingRef,
    minRadius,
    maxRadius,
    tooltipOffsetPx,
  } = useOrbitController({
    isDragging,
    layout: {
      useDesktopLayout,
      isSmallScreen,
      isTabletLike,
      xOffset: 0,
      yOffset: 0,
      xOffsetPx: wantsSkew ? -112 : 0,
      yOffsetPx: wantsSkew ? 12 : 0,
    },
    bounds: { minRadius: isSmallScreen ? 2 : 20, maxRadius: 800 },
    dataCount: safeData.length,
  } as any);

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
    () => (avg: number) => boostColor(rgbString(sampleStops(avg))),
    []
  );

  const points: any[] = useDotPoints(safeData, {
    spread,
    minDistance: 2.1,
    seed: 1337,
    relaxPasses: 1,
    relaxStrength: 0.25,
    centerBias: 0.35,
    colorForAverage,
    personalizedEntryId,
    showPersonalized: showCompleteUI && hasPersonalizedInDataset && shouldShowPersonalized,
  } as any);

  /* ---------- PREWARM textures once based on rendered order ---------- */
  useEffect(() => {
    if (!points || !points.length) return;
    const items = points.map((p, i) => ({
      avg: Number.isFinite(p?.averageWeight) ? p.averageWeight : 0.5,
      orderIndex: i,
      seed: 'dotgraph-bag-v1',
    }));
    prewarmSpriteTextures(items, { tileSize: 128, alpha: 215, blend: 0.6 } as any);
  }, [points]);

  // maps & helpers
  const posById = useMemo(() => new Map(points.map((p) => [p._id, p.position])), [points]);

  const myPoint = useMemo(
    () => points.find((p) => p?._id === personalizedEntryId),
    [points, personalizedEntryId]
  );

  const myEntry = useMemo(
    () => safeData.find((e) => e?._id === personalizedEntryId),
    [safeData, personalizedEntryId]
  );

  // ---- Fallbacks for umbrella views
  const mySnapshot = useMemo(() => {
    if (myEntry || typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem('gp.myDoc');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [myEntry]);

  const effectiveMyEntry = myEntry || mySnapshot;

  const fallbackColor = useMemo(() => {
    const avg = Number((effectiveMyEntry as any)?.avgWeight);
    if (!Number.isFinite(avg)) return '#ffffff';
    return rgbString(sampleStops(avg));
  }, [effectiveMyEntry]);

  const effectiveMyPoint =
    myPoint ||
    (effectiveMyEntry ? { position: [0, 0, 0], color: fallbackColor } : null);

  // ---- Metrics (relative vs absolute) ----
  const { getForId: getRelForId, getForValue: getRelForValue } = useRelativePercentiles(safeData);
  const { getForId: getAbsForId, getForValue: getAbsForValue } = useAbsoluteScore(safeData, {
    decimals: 0,
  } as any);

  const myDisplayValue = useMemo(() => {
    if (!(showCompleteUI && effectiveMyEntry)) return 0;

    if (myEntry) {
      return mode === 'relative' ? getRelForId(myEntry._id) : getAbsForId(myEntry._id);
    }

    const avg = Number((effectiveMyEntry as any)?.avgWeight);
    if (!Number.isFinite(avg)) return 0;

    try {
      return mode === 'relative' ? Math.round(getRelForValue(avg)) : Math.round(getAbsForValue(avg));
    } catch {
      return 0;
    }
  }, [
    showCompleteUI,
    effectiveMyEntry,
    myEntry,
    mode,
    getRelForId,
    getAbsForId,
    getRelForValue,
    getAbsForValue,
  ]);

  const calcValueForAvg = useCallback(
    (averageWeight: number) => {
      try {
        return mode === 'relative' ? getRelForValue(averageWeight) : getAbsForValue(averageWeight);
      } catch {
        return 0;
      }
    },
    [mode, getRelForValue, getAbsForValue]
  );

  const absScoreById = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of safeData) m.set(d._id, getAbsForId(d._id));
    return m;
  }, [safeData, getAbsForId]);

  // hover tooltips
  const { hoveredDot, viewportClass, onHoverStart, onHoverEnd } = useHoverBubble({
    useDesktopLayout,
    isDragging,
    isPinchingRef,
    isTouchRotatingRef,
    calcPercentForAvg: calcValueForAvg,
  } as any);

  // spotlight system (extracted)
  const { spotlightActiveRef } = useObserverSpotlight({
    points,
    onHoverStart: onHoverStart as any,
    onHoverEnd: onHoverEnd as any,
  });

  // ───────────────────────────────────────────────────────────
  // On mode/section/data change: clear hover/tie (guarded by spotlight)
  // ───────────────────────────────────────────────────────────
  const [selectedTieKey, setSelectedTieKey] = useState<number | null>(null);

  useEffect(() => {
    if (spotlightActiveRef.current) return;
    onHoverEnd(); // stop hover on mode change, keep tie line
    // intentionally NOT clearing selected tie on mode change (per your comment)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (spotlightActiveRef.current) return;
    onHoverEnd();
    setSelectedTieKey(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  useEffect(() => {
    if (spotlightActiveRef.current) return;
    onHoverEnd();
    setSelectedTieKey(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeData.length]);

  // ========= Shared key for buckets/rank-chain: rounded RAW % (avg*100) =========
  const linkKeyOf = useCallback((d: any) => Math.round(avgWeightOf(d) * 100), []);

  // global bottom→top chain, de-dup by linkKeyOf
  const rankChainIds = useMemo(() => {
    if (points.length < 2) return [];
    const entries = safeData.map((d) => ({
      id: d._id,
      avg: avgWeightOf(d),
      key: linkKeyOf(d),
    }));
    entries.sort((a, b) => a.avg - b.avg);

    const seenKeys = new Set<number>();
    const uniqueIds: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const k = entries[i].key;
      if (!seenKeys.has(k)) {
        uniqueIds.push(entries[i].id);
        seenKeys.add(k);
      }
    }
    return uniqueIds;
  }, [points, safeData, linkKeyOf]);

  const rankChainPoints = useMemo(
    () => rankChainIds.map((id) => posById.get(id)).filter(Boolean),
    [rankChainIds, posById]
  );

  const rankChainIdSet = useMemo(() => new Set(rankChainIds), [rankChainIds]);

  // ============================ LINKING by ROUNDED RAW AVG ============================
  const tieBuckets = useMemo(() => {
    const m = new Map<number, string[]>();
    if (!safeData.length) return m;
    for (const d of safeData) {
      const key = linkKeyOf(d);
      const arr = m.get(key) || [];
      arr.push(d._id);
      m.set(key, arr);
    }
    for (const [k, arr] of m) if (!arr || arr.length <= 1) m.delete(k);
    return m;
  }, [safeData, linkKeyOf]);

  const selectedTieLinePoints = useMemo(() => {
    if (selectedTieKey == null || !tieBuckets.has(selectedTieKey)) return [];
    const ids = (tieBuckets.get(selectedTieKey) || []).filter((id) => posById.has(id));
    if (ids.length < 2) return [];
    const pts = ids.map((id) => posById.get(id) as any);
    let cx = 0, cy = 0, cz = 0;
    for (const p of pts) {
      cx += p[0]; cy += p[1]; cz += p[2];
    }
    cx /= pts.length; cy /= pts.length; cz /= pts.length;
    return pts.slice().sort((a: any, b: any) => {
      const aa = Math.atan2(a[2] - cz, a[0] - cx);
      const bb = Math.atan2(b[2] - cz, b[0] - cx);
      return aa - bb;
    });
  }, [selectedTieKey, tieBuckets, posById]);

  const getTieKeyForId = (id: string): number | null => {
    const entry = safeData.find((d) => d._id === id);
    if (!entry) return null;
    const key = linkKeyOf(entry);
    const arr = tieBuckets.get(key);
    return arr && arr.length > 1 ? key : null;
  };

  const hoveredRelIds = useMemo(() => {
    if (mode !== 'relative' || !hoveredDot) return [];
    const entry = safeData.find((d) => d._id === hoveredDot.dotId);
    if (!entry) return [];
    const key = linkKeyOf(entry);
    return tieBuckets.get(key) || [];
  }, [mode, hoveredDot, safeData, tieBuckets, linkKeyOf]);

  const hoveredAbsEqualSet = useMemo(() => {
    if (mode !== 'absolute' || !hoveredDot) return new Set<string>();
    const score = absScoreById.get(hoveredDot.dotId);
    if (score == null) return new Set<string>();
    const ids = safeData
      .filter((d) => absScoreById.get(d._id) === score)
      .map((d) => d._id);
    return new Set<string>(ids);
  }, [mode, hoveredDot, absScoreById, safeData]);

  const mobileRotDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onRot = (e: any) => {
      const source = (e && e.detail && e.detail.source) || undefined;
      if (useDesktopLayout) return;
      if (source !== 'touch') return;
      if (mobileRotDismissRef.current) clearTimeout(mobileRotDismissRef.current);
      mobileRotDismissRef.current = setTimeout(() => {
        onHoverEnd();
        mobileRotDismissRef.current = null;
      }, 2000);
    };

    window.addEventListener('gp:orbit-rot', onRot as any);
    return () => {
      window.removeEventListener('gp:orbit-rot', onRot as any);
      if (mobileRotDismissRef.current) {
        clearTimeout(mobileRotDismissRef.current);
        mobileRotDismissRef.current = null;
      }
    };
  }, [useDesktopLayout, onHoverEnd]);

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

  const myStats =
    effectiveMyEntry && myEntry
      ? getTieStats({ data: safeData, targetId: myEntry._id })
      : { below: 0, equal: 0, above: 0, totalOthers: 0 };

  const myClass = classifyPosition(myStats);

  const hoveredStats = useMemo(() => {
    if (!hoveredDot) return { below: 0, equal: 0, above: 0, totalOthers: 0 };
    return getTieStats({ data: safeData, targetId: hoveredDot.dotId });
  }, [hoveredDot, safeData]);

  const hoveredClass = classifyPosition(hoveredStats);

  // ------------------------- DYNAMIC SPRITE SCALE -------------------------
  const spriteScale = useMemo(() => {
    const denom = Math.max(1e-6, maxRadius - minRadius);
    const t = Math.max(0, Math.min(1, (radius - minRadius) / denom));
    const SCALE_MIN = 7;
    const SCALE_MAX = 12;
    return nonlinearLerp(SCALE_MAX, SCALE_MIN, t);
  }, [radius, minRadius, maxRadius]);

  const bleedOf = (shapeKey: string) =>
    BLEED_FRAC[shapeKey] || { top: 0, right: 0, bottom: 0, left: 0 };

  // ---------------------- DUPLICATE-RENDER GUARDS ------------------------
  const shouldRenderPersonalUI =
    showCompleteUI && shouldShowPersonalized && !!effectiveMyPoint && !!effectiveMyEntry;

  const shouldRenderExtraPersonalSprite = shouldRenderPersonalUI && !hasPersonalizedInDataset;

  // ====== SHUFFLE-BAG SEED ======
  const bagSeed = 'dotgraph-bag-v1';

  // queue progress → small top-center indicator
  const { isBusy, pending } = useTextureQueueProgress();

  // Open the personalized panel exactly when the UI is ready (one-shot)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const wantOpen = sessionStorage.getItem('gp.openPersonalOnNext') === '1';
    if (!wantOpen) return;
    if (!shouldRenderPersonalUI) return;
    try {
      window.dispatchEvent(new CustomEvent('gp:open-personalized'));
    } finally {
      sessionStorage.removeItem('gp.openPersonalOnNext');
    }
  }, [shouldRenderPersonalUI]);

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

      {isBusy && (
        <Html center zIndexRange={[200, 250]} style={{ pointerEvents: 'none' }}>
          <div style={loaderCardStyle} className="loading-dots">
            <span role="img" aria-label="city">
              🌆
            </span>
            &nbsp; Community is loading…
            {Number.isFinite(pending) ? ` (${pending})` : ''}
          </div>
        </Html>
      )}

      <group ref={groupRef as any}>
        {points.map((point, i) => {
          const suppressHover = !!(myEntry && point._id === personalizedEntryId && showCompleteUI);

          const tieKey = getTieKeyForId(point._id);
          const isInSelectedTie = selectedTieKey != null && tieKey === selectedTieKey;

          const showAbsEqualHoverHover = mode === 'absolute' && hoveredAbsEqualSet.has(point._id);
          const showRelEqualHoverHover =
            mode === 'relative' && hoveredRelIds.length > 1 && hoveredRelIds.includes(point._id);

          const _unused =
            isInSelectedTie ||
            showRelEqualHoverHover ||
            showAbsEqualHoverHover ||
            rankChainIdSet.has(point._id);
          void _unused;

          const avg = Number.isFinite(point.averageWeight) ? point.averageWeight : 0.5;

          const chosenShape = shapeForAvg(avg, bagSeed, i);
          const fp = (SHAPE_FOOTPRINT as any)[chosenShape] ?? { w: 1, h: 1 };
          const aspect = fp.w / Math.max(0.0001, fp.h);

          const b = bleedOf(chosenShape);
          const sCompX = 1 / (1 + (b.left || 0) + (b.right || 0));
          const sCompY = 1 / (1 + (b.top || 0) + (b.bottom || 0));

          const sx = spriteScale * aspect * sCompX;
          const sy = spriteScale * sCompY;

          return (
            <group
              key={point._id ?? `${point.position?.[0]}-${point.position?.[1]}-${point.position?.[2]}`}
              position={point.position as any}
            >
              <sprite
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
                  const key = getTieKeyForId(point._id);
                  setSelectedTieKey((prev) => (prev === key ? null : (key ?? null)));
                }}
                scale={[sx, sy, 1]}
              >
                <spriteMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
              </sprite>

              <SpriteShape
                avg={avg}
                position={[0, 0, 0]}
                scale={spriteScale}
                tileSize={128}
                alpha={215}
                blend={0.6}
                seed={bagSeed}
                orderIndex={i}
                freezeParticles={true}
                particleStepMs={33}
                particleFrames={219}
              />
            </group>
          );
        })}

        {selectedTieKey != null && selectedTieLinePoints.length >= 2 && (
          <Line
            points={selectedTieLinePoints as any}
            color="#a3a3a3"
            lineWidth={1.5}
            dashed={false}
            toneMapped={false}
            transparent
            opacity={0.75}
          />
        )}

        {shouldRenderPersonalUI && (
          <>
            {shouldRenderExtraPersonalSprite && effectiveMyPoint && (
              <group position={(effectiveMyPoint as any).position}>
                <SpriteShape
                  avg={
                    Number.isFinite((effectiveMyEntry as any)?.avgWeight)
                      ? Number((effectiveMyEntry as any).avgWeight)
                      : 0.5
                  }
                  position={[0, 0, 0]}
                  scale={spriteScale}
                  tileSize={128}
                  alpha={215}
                  blend={0.6}
                  seed={bagSeed}
                  orderIndex={0}
                  freezeParticles={true}
                  particleStepMs={33}
                  particleFrames={219}
                />
              </group>
            )}

            {effectiveMyPoint && (
              <Html
                position={(effectiveMyPoint as any).position}
                center
                zIndexRange={[110, 130]}
                style={{
                  pointerEvents: 'none',
                  ['--offset-px' as any]: `${offsetPx}px`,
                }}
              >
                <div>
                  <GamificationPersonalized
                    userData={effectiveMyEntry}
                    percentage={myDisplayValue}
                    color={(effectiveMyPoint as any).color}
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
            )}
          </>
        )}

        {hoveredDot &&
          (() => {
            const hoveredData = points.find((d) => d._id === hoveredDot.dotId);
            if (!hoveredData) return null;

            const hoveredEntry = safeData.find((d) => d._id === hoveredDot.dotId);
            const hoveredAvg = hoveredEntry ? avgWeightOf(hoveredEntry) : undefined;

            let displayPct = 0;
            if (Number.isFinite(hoveredAvg as any)) {
              try {
                displayPct = Math.round(calcValueForAvg(hoveredAvg as number));
              } catch {
                displayPct = 0;
              }
            }

            if (!Number.isFinite(displayPct) || displayPct < 0) {
              displayPct =
                mode === 'relative'
                  ? getRelForId(hoveredDot.dotId)
                  : (absScoreById.get(hoveredDot.dotId) ?? 0);
            }

            const hoveredStats2 = hoveredEntry
              ? getTieStats({ data: safeData, targetId: hoveredEntry._id })
              : { below: 0, equal: 0, above: 0, totalOthers: 0 };

            const hoveredClass2 = classifyPosition(hoveredStats2);

            return (
              <Html
                position={hoveredData.position as any}
                center
                zIndexRange={[120, 180]}
                style={{
                  pointerEvents: 'none',
                  ['--offset-px' as any]: `${offsetPx}px`,
                  opacity: 1,
                }}
                className={viewportClass}
              >
                <div>
                  <GamificationGeneral
                    dotId={hoveredDot.dotId}
                    percentage={displayPct}
                    color={hoveredData.color}
                    mode={mode}
                    belowCountStrict={hoveredStats2.below}
                    equalCount={hoveredStats2.equal}
                    aboveCountStrict={hoveredStats2.above}
                    positionClass={hoveredClass2.position}
                    tieContext={hoveredClass2.tieContext}
                  />
                </div>
              </Html>
            );
          })()}
      </group>
    </>
  );
}
