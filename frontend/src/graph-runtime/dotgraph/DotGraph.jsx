// src/components/dotGraph/dotGraph.jsx
import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';

import CompleteButton from '../../weighted-survey/CompleteButton.jsx';

import GamificationPersonalized from '../gamification/GamificationPersonalized.jsx';
import GamificationGeneral from '../gamification/GamificationGeneral.jsx';

import { useAppState } from '../../app-context/appStateContext.tsx';

import { useRealMobileViewport } from '../../utils-hooks/real-mobile.ts';
import { sampleStops, rgbString } from '../../utils-hooks/hooks.ts';
import { useRelativePercentiles, avgWeightOf } from '../../utils-hooks/useRelativePercentiles.ts';
import { useAbsoluteScore } from '../../utils-hooks/useAbsoluteScore.ts';

import useOrbit from '../hooks/event-handling/index.js';
import useDotPoints from '../hooks/useDotPoints.js';
import useHoverBubble from '../hooks/useHoverBubble.js';
import useObserverDelay from '../hooks/useObserverDelay.js';

import { getTieStats, classifyPosition } from '../gamification/rankLogic.js';

import { SpriteShape, prewarmSpriteTextures } from '../sprites/entry.ts';

import { shapeForAvg } from '../sprites/selection/shapeForAvg.ts';
import { FOOTPRINTS as SHAPE_FOOTPRINT } from '../sprites/selection/footprints.ts';

import { useTextureQueueProgress } from '../sprites/entry.ts';

import { ROLE_SECTIONS } from '../../weighted-survey/section-picker/sections.js';


/* ---------- small utils ---------- */
const nonlinearLerp = (a, b, t) => {
  const x = Math.max(0, Math.min(1, t));
  return a + (b - a) * (1 - Math.pow(1 - x, 5));
};

// Perceptual "pop": move a bit toward fully saturated, slightly darker version
const boostColor = (rgbHexOrCss) => {
  const c = new THREE.Color(rgbHexOrCss);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const target = new THREE.Color().setHSL(hsl.h, 1, Math.max(0, hsl.l * 0.9));
  const t = 0.9 * (1 - hsl.s);
  c.lerp(target, t);
  return `#${c.getHexString()}`;
};

/**
 * Per-shape overflow/bleed as FRACTIONS of the base tile.
 * These are only used to size the invisible hit target so pointer events
 * align with what’s visible when the texture is rendered with bleed.
 */
const BLEED_FRAC = {
  trees: { top: 0.28, right: 0.00, bottom: 0.00, left: 0.00 },

  clouds: { top: 0, right: 0, bottom: 0, left: 0 },
  bus: { top: 0, right: 0, bottom: 0, left: 0 },
  snow: { top: 0, right: 0, bottom: 0, left: 0 },
  house:{ top: 0, right: 0, bottom: 0, left: 0 },
  power:{ top: 0, right: 0, bottom: 0, left: 0 },
  sun:  { top: 0, right: 0, bottom: 0, left: 0 },
  villa:{ top: 0, right: 0, bottom: 0, left: 0 },
  car:  { top: 0, right: 0, bottom: 0, left: 0 },
  sea:  { top: 0, right: 0, bottom: 0, left: 0 },
  carFactory: { top: 0, right: 0, bottom: 0, left: 0 },
};

/* ───────────────────────────────────────────────────────────
   SCOPING: strict role-from-section + normalization + rules
   (first-render safe via sessionStorage fallback)
   ─────────────────────────────────────────────────────────── */

// Canonical role buckets
const ROLE_VISITOR = 'visitor';
const ROLE_STUDENTS = 'all-students';
const ROLE_STAFF = 'all-staff';
const ROLE_UNKNOWN = 'unknown';

// Canonical section buckets (plus concrete department ids)
const BUCKETS = new Set(['all', 'all-massart', 'all-students', 'all-staff', 'visitor']);

const normStr = (v) => String(v ?? '').trim().toLowerCase();

// Normalize section ids/labels to canonical buckets; pass through dept ids
function normSection(sectionRaw) {
  const s = normStr(sectionRaw);
  if (!s) return 'all'; // empty means Everyone
  if (s === 'all' || s.includes('everyone')) return 'all';
  if (s.includes('massart')) return 'all-massart';
  if (s.includes('all-students') || s.includes('all students')) return 'all-students';
  if (s.includes('all-staff') || s.includes('all staff') || s.includes('faculty/staff') || s.includes('faculty-staff')) return 'all-staff';
  if (s.includes('visitor')) return 'visitor';
  // anything else is a concrete department id (e.g., 'animation')
  return s;
}

// Build fast lookup sets once
const STUDENT_ID_SET = new Set(ROLE_SECTIONS.student.map(s => s.value));
const STAFF_ID_SET   = new Set(ROLE_SECTIONS.staff.map(s => s.value));

// Strictly derive the user's role from their saved section id
function deriveRoleFromSectionId(mySectionRaw) {
  const s = normSection(mySectionRaw);
  if (s === 'visitor') return ROLE_VISITOR;
  if (STUDENT_ID_SET.has(s) || s === 'all-students') return ROLE_STUDENTS;
  if (STAFF_ID_SET.has(s)   || s === 'all-staff')    return ROLE_STAFF;
  return ROLE_UNKNOWN;
}

// Compute the full allowed scope set for a given user
function includedScopesForUser(role, mySectionRaw) {
  const me = normSection(mySectionRaw);

  switch (role) {
    case ROLE_VISITOR: {
      // Visitors ONLY in Everyone & Visitors
      return new Set(['all', 'visitor']);
    }
    case ROLE_STUDENTS: {
      const set = new Set(['all-students', 'all-massart', 'all']);
      if (me && !BUCKETS.has(me)) set.add(me); // exact department
      return set;
    }
    case ROLE_STAFF: {
      const set = new Set(['all-staff', 'all-massart', 'all']);
      if (me && !BUCKETS.has(me)) set.add(me); // exact department
      return set;
    }
    case ROLE_UNKNOWN:
    default: {
      // Conservative default: my dept (if any) + MassArt + Everyone
      const set = new Set(['all-massart', 'all']);
      if (me && !BUCKETS.has(me)) set.add(me);
      return set;
    }
  }
}

// Membership predicate used by DotGraph
function allowPersonalInSection(role, mySectionRaw, sectionRaw) {
  const here = normSection(sectionRaw); // empty -> 'all'
  return includedScopesForUser(role, mySectionRaw).has(here);
}

const DotGraph = ({ isDragging = false, data = [] }) => {
  const { myEntryId, mySection, /* myRole (unused on purpose) */ observerMode, mode, section } = useAppState();
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

  const hasPersonalizedInDataset = useMemo(
    () => !!personalizedEntryId && safeData.some(d => d._id === personalizedEntryId),
    [personalizedEntryId, safeData]
  );

  /* ───────────────────────────────────────────────────────────
     First-render safe identity + strict role derivation
     ─────────────────────────────────────────────────────────── */
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
    const viewing = section || (typeof window !== 'undefined' ? sessionStorage.getItem('gp.viewingSection') : null) || 'all';
    const ok = allowPersonalInSection(viewerRole, effectiveMySection, viewing);

    // HARD GUARD: visitors *only* in Everyone & Visitors,
    // even if their row appears in umbrella datasets.
    if (viewerRole === ROLE_VISITOR) {
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
  } = useOrbit({
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
    () => (avg) => boostColor(rgbString(sampleStops(avg))),
    []
  );

  const points = useDotPoints(safeData, {
    spread,
    minDistance: 2.1,
    seed: 1337,
    relaxPasses: 1,
    relaxStrength: 0.25,
    centerBias: 0.35,
    colorForAverage,
    personalizedEntryId,
    showPersonalized: showCompleteUI && hasPersonalizedInDataset && shouldShowPersonalized,
  });

  /* ---------- PREWARM textures once based on rendered order ---------- */
  useEffect(() => {
    if (!points || !points.length) return;
    const items = points.map((p, i) => ({
      avg: Number.isFinite(p.averageWeight) ? p.averageWeight : 0.5,
      orderIndex: i,
      seed: 'dotgraph-bag-v1',
    }));
    prewarmSpriteTextures(items, { tileSize: 128, alpha: 215, blend: 0.6 });
  }, [points]);

  // maps & helpers
  const posById = useMemo(() => new Map(points.map(p => [p._id, p.position])), [points]);

  const myPoint = useMemo(
    () => points.find(p => p._id === personalizedEntryId),
    [points, personalizedEntryId]
  );
  const myEntry = useMemo(
    () => safeData.find(e => e._id === personalizedEntryId),
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
    const avg = Number(effectiveMyEntry?.avgWeight);
    if (!Number.isFinite(avg)) return '#ffffff';
    return rgbString(sampleStops(avg));
  }, [effectiveMyEntry]);

  const effectiveMyPoint = myPoint || (effectiveMyEntry
    ? { position: [0, 0, 0], color: fallbackColor }
    : null);

  // ---- Metrics (relative vs absolute) ----
  const {
    getForId: getRelForId,
    getForValue: getRelForValue,
  } = useRelativePercentiles(safeData);

  const { getForId: getAbsForId, getForValue: getAbsForValue } = useAbsoluteScore(safeData, { decimals: 0 });

  const myDisplayValue = useMemo(() => {
    if (!(showCompleteUI && effectiveMyEntry)) return 0;

    if (myEntry) {
      return mode === 'relative' ? getRelForId(myEntry._id) : getAbsForId(myEntry._id);
    }

    const avg = Number(effectiveMyEntry?.avgWeight);
    if (!Number.isFinite(avg)) return 0;
    try {
      return mode === 'relative'
        ? Math.round(getRelForValue(avg))
        : Math.round(getAbsForValue(avg));
    } catch {
      return 0;
    }
  }, [showCompleteUI, effectiveMyEntry, myEntry, mode, getRelForId, getAbsForId, getRelForValue, getAbsForValue]);

  const calcValueForAvg = useCallback(
    (averageWeight) => {
      try {
        return mode === 'relative'
          ? getRelForValue(averageWeight)
          : getAbsForValue(averageWeight);
      } catch {
        return 0;
      }
    },
    [mode, getRelForValue, getAbsForValue]
  );

  const absScoreById = useMemo(() => {
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

  /* ================= HARDENING: spotlight lifecycle guards ================= */
  const spotlightTimerRef = useRef(null);
  const spotlightActiveRef = useRef(false);

  // Keep latest handlers & points in refs so a single event listener stays valid
  const onHoverStartRef = useRef(onHoverStart);
  const onHoverEndRef = useRef(onHoverEnd);
  const pointsRef = useRef(points);
  useEffect(() => { onHoverStartRef.current = onHoverStart; }, [onHoverStart]);
  useEffect(() => { onHoverEndRef.current = onHoverEnd; }, [onHoverEnd]);
  useEffect(() => { pointsRef.current = points; }, [points]);

  /* ───────────────────────────────────────────────────────────
     CHANGE: On mode change, do NOT clear the selected tie line.
     We still end any transient hover to avoid ghost tooltips.
     On section change, we clear both hover and selected tie (as before).
     ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (spotlightActiveRef.current) return;
    onHoverEnd();          // stop hover on mode change, keep tie line
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (spotlightActiveRef.current) return;
    onHoverEnd();
    setSelectedTieKey(null); // clear tie line when changing sections
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  // clear hover/tie when dataset size changes, unless spotlight is active
  useEffect(() => {
    if (spotlightActiveRef.current) return;
    onHoverEnd();
    setSelectedTieKey(null);
  }, [safeData.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ===== Observer spotlight (programmatic, short-lived general tooltip) ===== */
  useEffect(() => {
    const onSpotlight = (evt) => {
      const { detail } = evt || {};
      const durationMs = Math.max(500, Number(detail?.durationMs) || 3000);
      const xRatio = Math.max(0, Math.min(1, Number(detail?.fakeMouseXRatio) || 0.5));
      const yRatio = Math.max(0, Math.min(1, Number(detail?.fakeMouseYRatio) || 0.5));

      const pts = pointsRef.current || [];
      if (!pts.length) return;

      // Pick a central point (closest to origin)
      let best = null;
      let bestD = Infinity;
      for (const p of pts) {
        const pos = p?.position || [0, 0, 0];
        if (!Array.isArray(pos) || pos.length < 3) continue;
        const [x, y, z] = pos;
        const d = x*x + y*y + z*z;
        if (d < bestD) { bestD = d; best = p; }
      }
      if (!best) return;

      // cancel existing timer
      if (spotlightTimerRef.current) {
        clearTimeout(spotlightTimerRef.current);
        spotlightTimerRef.current = null;
      }

      // lock out auto-cleans
      spotlightActiveRef.current = true;

      // synthesize light pointer coords for viewport placement
      const synthEvt = {
        stopPropagation: () => {},
        preventDefault: () => {},
        clientX: (typeof window !== 'undefined' ? window.innerWidth  : 1000) * xRatio,
        clientY: (typeof window !== 'undefined' ? window.innerHeight :  800) * yRatio,
      };

      try { onHoverStartRef.current?.(best, synthEvt); } catch {}

      spotlightTimerRef.current = setTimeout(() => {
        try { onHoverEndRef.current?.(); } catch {}
        spotlightActiveRef.current = false;
        spotlightTimerRef.current = null;
      }, durationMs);
    };

    window.addEventListener('gp:observer-spotlight-request', onSpotlight);
    return () => {
      window.removeEventListener('gp:observer-spotlight-request', onSpotlight);
      if (spotlightTimerRef.current) {
        clearTimeout(spotlightTimerRef.current);
        spotlightTimerRef.current = null;
      }
      spotlightActiveRef.current = false;
    };
  }, []); // mount-once

  // ========= Shared key for buckets/rank-chain: rounded RAW % (avg*100) =========
  const linkKeyOf = useCallback(
    (d) => Math.round(avgWeightOf(d) * 100), // integer 0..100
    []
  );

  // ----- global bottom→top chain, de-dup by linkKeyOf (one per rounded %)
  const rankChainIds = useMemo(() => {
    if (points.length < 2) return [];
    const entries = safeData.map(d => ({ id: d._id, avg: avgWeightOf(d), key: linkKeyOf(d) }));
    entries.sort((a, b) => a.avg - b.avg);

    const seenKeys = new Set();
    const uniqueIds = [];
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
    () => rankChainIds.map(id => posById.get(id)).filter(Boolean),
    [rankChainIds, posById]
  );

  const rankChainIdSet = useMemo(() => new Set(rankChainIds), [rankChainIds]);

  // ============================ LINKING by ROUNDED RAW AVG ============================
  const tieBuckets = useMemo(() => {
    const m = new Map(); // key: integer 0..100 -> ids[]
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

  const [selectedTieKey, setSelectedTieKey] = useState(null);
  // NOTE: removed the old `useEffect(() => setSelectedTieKey(null), [mode])`

  const selectedTieLinePoints = useMemo(() => {
    if (selectedTieKey == null || !tieBuckets.has(selectedTieKey)) return [];
    const ids = tieBuckets.get(selectedTieKey).filter(id => posById.has(id));
    if (ids.length < 2) return [];
    const pts = ids.map(id => posById.get(id));
    let cx = 0, cy = 0, cz = 0;
    for (const p of pts) { cx += p[0]; cy += p[1]; cz += p[2]; }
    cx /= pts.length; cy /= pts.length; cz /= pts.length;
    return pts.slice().sort((a,b) => {
      const aa = Math.atan2(a[2]-cz, a[0]-cx);
      const bb = Math.atan2(b[2]-cz, b[0]-cx);
      return aa - bb;
    });
  }, [selectedTieKey, tieBuckets, posById]);

  const getTieKeyForId = (id) => {
    const entry = safeData.find(d => d._id === id);
    if (!entry) return null;
    const key = linkKeyOf(entry);
    const arr = tieBuckets.get(key);
    return arr && arr.length > 1 ? key : null;
  };

  const hoveredRelIds = useMemo(() => {
    if (mode !== 'relative' || !hoveredDot) return [];
    const entry = safeData.find(d => d._id === hoveredDot.dotId);
    if (!entry) return [];
    const key = linkKeyOf(entry);
    return tieBuckets.get(key) || [];
  }, [mode, hoveredDot, safeData, tieBuckets, linkKeyOf]);

  const hoveredAbsEqualSet = useMemo(() => {
    if (mode !== 'absolute' || !hoveredDot) return new Set();
    const score = absScoreById.get(hoveredDot.dotId);
    if (score == null) return new Set();
    const ids = safeData.filter(d => absScoreById.get(d._id) === score).map(d => d._id);
    return new Set(ids);
  }, [mode, hoveredDot, absScoreById, safeData]);

  const mobileRotDismissRef = useRef(null);
  useEffect(() => {
    const onRot = (e) => {
      const { source } = (e && e.detail) || {};
      if (useDesktopLayout) return;
      if (source !== 'touch') return;
      if (mobileRotDismissRef.current) clearTimeout(mobileRotDismissRef.current);
      mobileRotDismissRef.current = setTimeout(() => {
        onHoverEnd();
        mobileRotDismissRef.current = null;
      }, 2000);
    };
    window.addEventListener('gp:orbit-rot', onRot);
    return () => {
      window.removeEventListener('gp:orbit-rot', onRot);
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

  const myStats = effectiveMyEntry && myEntry
    ? getTieStats({ data: safeData, targetId: myEntry._id })
    : { below: 0, equal: 0, above: 0, totalOthers: 0 };
  const myClass  = classifyPosition(myStats);

  const hoveredStats = useMemo(() => {
    if (!hoveredDot) return { below: 0, equal: 0, above: 0, totalOthers: 0 };
    return getTieStats({ data: safeData, targetId: hoveredDot.dotId });
  }, [hoveredDot, safeData]);
  const hoveredClass = classifyPosition(hoveredStats);

  // ------------------------- DYNAMIC SPRITE SCALE -------------------------
  const spriteScale = useMemo(() => {
    const denom = Math.max(1e-6, (maxRadius - minRadius));
    const t = Math.max(0, Math.min(1, (radius - minRadius) / denom)); // 0 = zoomed in, 1 = zoomed out
    const SCALE_MIN = 7;  // smallest at far zoom
    const SCALE_MAX = 12; // largest when close
    return nonlinearLerp(SCALE_MAX, SCALE_MIN, t);
  }, [radius, minRadius, maxRadius]);

  // helper to read bleed fractions for a shape
  const bleedOf = (shapeKey) => BLEED_FRAC[shapeKey] || { top: 0, right: 0, bottom: 0, left: 0 };

  // ---------------------- DUPLICATE-RENDER GUARDS ------------------------
  const shouldRenderPersonalUI =
    showCompleteUI && shouldShowPersonalized && !!effectiveMyPoint && !!effectiveMyEntry;

  // Draw an extra personalized sprite ONLY when your entry is NOT already in points
  const shouldRenderExtraPersonalSprite =
    shouldRenderPersonalUI && !hasPersonalizedInDataset;

  // ====== SHUFFLE-BAG SEED ======
  const bagSeed = 'dotgraph-bag-v1';

  // queue progress → small top-center indicator
  const { isBusy, pending } = useTextureQueueProgress();

  // Open the personalized panel exactly when the UI is ready (one-shot)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const wantOpen = sessionStorage.getItem('gp.openPersonalOnNext') === '1';
    if (!wantOpen) return;
    if (!shouldRenderPersonalUI) return; // wait until personalized UI can render
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
            style={{ display:'flex', justifyContent:'flex-start', alignItems:'center', height:'100vh', pointerEvents:'none' }}
          >
            <CompleteButton />
          </div>
        </Html>
      )}

      {/* tiny loading indicator (reuses your animated dots class) */}
      {isBusy && (
        <Html center zIndexRange={[200, 250]} style={{ pointerEvents: 'none' }}>
          <div
            style={loaderCardStyle}
            className="loading-dots"
          >
            <span role="img" aria-label="city">🌆</span>&nbsp; Community is loading…
            {Number.isFinite(pending) ? ` (${pending})` : ''}
          </div>
        </Html>
      )}

      <group ref={groupRef}>
        {points.map((point, i) => {
          const suppressHover = !!(myEntry && point._id === personalizedEntryId && showCompleteUI);

          const tieKey = getTieKeyForId(point._id);
          const isInSelectedTie = selectedTieKey != null && tieKey === selectedTieKey;

          const showAbsEqualHoverHover = mode === 'absolute' && hoveredAbsEqualSet.has(point._id);
          const showRelEqualHoverHover =
            mode === 'relative' &&
            hoveredRelIds.length > 1 &&
            hoveredRelIds.includes(point._id);

          const _unused = isInSelectedTie || showRelEqualHoverHover || showAbsEqualHoverHover || rankChainIdSet.has(point._id);
          void _unused;

          const avg = Number.isFinite(point.averageWeight) ? point.averageWeight : 0.5;

          // Use the SAME chooser as the sprite, including orderIndex=i
          const chosenShape = shapeForAvg(avg, bagSeed, i);
          const fp = SHAPE_FOOTPRINT[chosenShape] ?? { w: 1, h: 1 };
          const aspect = fp.w / Math.max(0.0001, fp.h);

          const b = bleedOf(chosenShape);
          const sCompX = 1 / (1 + (b.left || 0) + (b.right || 0));
          const sCompY = 1 / (1 + (b.top || 0) + (b.bottom || 0));

          const sx = spriteScale * aspect * sCompX;
          const sy = spriteScale * sCompY;

          return (
            <group
              key={point._id ?? `${point.position[0]}-${point.position[1]}-${point.position[2]}` }
              position={point.position}
            >
              {/* Invisible hit area aligned to sprite aspect, including bleed comp */}
              <sprite
                onPointerOver={(e) => { e.stopPropagation(); if (!suppressHover) onHoverStart(point, e); }}
                onPointerOut={(e) =>  { e.stopPropagation(); if (!suppressHover) onHoverEnd(); }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!suppressHover) onHoverStart(point, e);
                  // allow selecting tie in BOTH modes (relative & absolute)
                  const key = getTieKeyForId(point._id);
                  setSelectedTieKey(prev => (prev === key ? null : (key ?? null)));
                }}
                scale={[sx, sy, 1]}
              >
                <spriteMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
              </sprite>

              {/* Visible SHAPE (sprite) */}
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

        {/* Show the connecting line in BOTH modes when a tie group is selected */}
        {selectedTieKey != null && selectedTieLinePoints.length >= 2 && (
          <Line
            points={selectedTieLinePoints}
            color="#a3a3a3"
            lineWidth={1.5}
            dashed={false}
            toneMapped={false}
            transparent
            opacity={0.75}
          />
        )}

        {/* Personalized (no halo) */}
        {shouldRenderPersonalUI && (
          <>
            {shouldRenderExtraPersonalSprite && (
              <group position={effectiveMyPoint.position}>
                <SpriteShape
                  avg={Number.isFinite(effectiveMyEntry?.avgWeight) ? Number(effectiveMyEntry.avgWeight) : 0.5}
                  position={[0,0,0]}
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

            <Html
              position={effectiveMyPoint.position}
              center
              zIndexRange={[110, 130]}
              style={{ pointerEvents:'none', '--offset-px': `${offsetPx}px` }}
            >
              <div>
                <GamificationPersonalized
                  userData={effectiveMyEntry}
                  percentage={myDisplayValue}
                  color={effectiveMyPoint.color}
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

          const hoveredEntry = safeData.find(d => d._id === hoveredDot.dotId);
          const hoveredAvg = hoveredEntry ? avgWeightOf(hoveredEntry) : undefined;

          let displayPct = 0;
          if (Number.isFinite(hoveredAvg)) {
            try {
              displayPct = Math.round(calcValueForAvg(hoveredAvg));
            } catch {
              displayPct = 0;
            }
          }

          if (!Number.isFinite(displayPct) || displayPct < 0) {
            displayPct = mode === 'relative'
              ? getRelForId(hoveredDot.dotId)
              : (absScoreById.get(hoveredDot.dotId) ?? 0);
          }

          const hoveredStats2 = hoveredEntry
            ? getTieStats({ data: safeData, targetId: hoveredEntry._id })
            : { below: 0, equal: 0, above: 0, totalOthers: 0 };
          const hoveredClass2 = classifyPosition(hoveredStats2);

          return (
            <Html
              position={hoveredData.position}
              center
              zIndexRange={[120, 180]}
              style={{ pointerEvents:'none', '--offset-px': `${offsetPx}px`, opacity: 1 }}
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
};

const loaderCardStyle = {
  pointerEvents: 'none',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  color: 'gray',
  borderRadius: 6,
  padding: '24px 16px',
  letterSpacing: 0.2,
  whiteSpace: 'nowrap',
};

export default DotGraph;
