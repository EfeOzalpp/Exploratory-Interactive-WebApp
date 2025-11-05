import { useEffect, useMemo, useRef, useState } from 'react';
import { calcRadii, pointOnCircle, clientToSvg, makeRingPath as makeRingPathRaw, triPointsPath } from './geometry.ts';
import { usePointerDrag } from './usePointerDrag.ts';
import { clamp, easeFn, colorForFactory } from './colors.ts';

type ShapeKey = 'triangle' | 'circle' | 'square' | 'diamond';
type Weights = Record<ShapeKey, number>;

// Base (desktop) sizes — these get scaled on mobile via shapeScale
const BASE_TRI_R = 28, BASE_CIR_R = 26, BASE_SQR_S = 44, BASE_DM_S = 44;
const MARGIN_EXTRA = 2;

// ── Sticky-deactivation thresholds
const DEACTIVATE_EPS = 0.02; // <= marks OFF (when pushed near rim)
const REACTIVATE_EPS = 0.06; // >= while dragging re-enables

// Base visual “pot” and dynamic reduction per deactivated shape
const BASE_BUCKET_CAP = 2;
const CAP_STEP_PER_DEACTIVATED = 0.5;
const MIN_BUCKET_CAP = 0.5; // do not go below this

const activeSetOf = (deactivated: Set<ShapeKey>) =>
  (['triangle', 'circle', 'square', 'diamond'] as ShapeKey[]).filter(k => !deactivated.has(k));

// Hook-local helper: responsive media query -> shape scale
function useShapeScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mql = window.matchMedia('(max-width: 768px)');
    const update = () => setScale(mql.matches ? 1.18 : 1);
    update();
    mql.addEventListener?.('change', update);
    // @ts-ignore legacy
    mql.addListener?.(update);
    return () => {
      mql.removeEventListener?.('change', update);
      // @ts-ignore legacy
      mql.removeListener?.(update);
    };
  }, []);
  return scale;
}

export function useSelectionState({
  size,
  onWeightsChange,
  onDragHover, // ← NEW: notify current dragged shape for cross-component highlight
}: {
  size: number;
  onWeightsChange?: (weights: Weights) => void;
  onDragHover?: (shape?: ShapeKey) => void;
}) {
  const shapeScale = useShapeScale();

  // Derived, responsive sizes
  const TRI_R = Math.round(BASE_TRI_R * shapeScale);
  const CIR_R = Math.round(BASE_CIR_R * shapeScale);
  const SQR_S = Math.round(BASE_SQR_S * shapeScale);
  const DM_S  = Math.round(BASE_DM_S  * shapeScale);

  const extentFor = (k: ShapeKey) => {
    switch (k) {
      case 'triangle': return TRI_R + MARGIN_EXTRA;
      case 'circle':   return CIR_R + MARGIN_EXTRA;
      case 'square':   return SQR_S / 2 + MARGIN_EXTRA;
      case 'diamond':  return (DM_S / 2) * Math.SQRT2 + MARGIN_EXTRA;
    }
  };

  const { half, inset, R, OUTER_R, R_ACTIVE } = calcRadii(size);
  const maxRadiusFor = (k: ShapeKey) => Math.max(0, OUTER_R - extentFor(k));

  // --- Cardinal angles for the "+" initial layout
  const ANGLES: Record<ShapeKey, number> = {
    circle:   -Math.PI / 2, // top
    square:    Math.PI,     // left
    triangle:  0,           // right
    diamond:   Math.PI / 2, // bottom
  };

  // Equal placement: r = 0.5 * R_ACTIVE (weights start at 0.5)
  const makeInitialPos = () => {
    const baseWeight = BASE_BUCKET_CAP / 4; // 0.5
    const rMid = (1 - baseWeight) * R_ACTIVE; // 0.5 * R_ACTIVE
    const res = {} as Record<ShapeKey, { x: number; y: number }>;
    (['triangle', 'circle', 'square', 'diamond'] as ShapeKey[]).forEach((k) => {
      const r = Math.min(rMid, maxRadiusFor(k));
      res[k] = pointOnCircle(half, ANGLES[k], r);
    });
    return res;
  };

  const initialPos: Record<ShapeKey, { x: number; y: number }> = makeInitialPos();

  // --- Refs & state
  const [pos, setPos] = useState(initialPos);
  const posRef = useRef(pos);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef<ShapeKey | null>(null);
  const frameRef = useRef<number | null>(null);

  // Targets (sum will be constrained to a dynamic cap)
  const weightsRef = useRef<Weights>({
    triangle: BASE_BUCKET_CAP / 4,
    circle:   BASE_BUCKET_CAP / 4,
    square:   BASE_BUCKET_CAP / 4,
    diamond:  BASE_BUCKET_CAP / 4,
  });
  const visualWRef = useRef<Weights>({ ...weightsRef.current });
  const [, bump] = useState(0);

  // Lock initial angles to the '+' layout
  const angleRef = useRef<Record<ShapeKey, number>>({
    triangle: ANGLES.triangle,
    circle:   ANGLES.circle,
    square:   ANGLES.square,
    diamond:  ANGLES.diamond,
  });

  // Sticky deactivation set
  const deactivatedRef = useRef<Set<ShapeKey>>(new Set());

  const commitPos = () => {
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setPos(posRef.current);
    });
  };

  // --- Weight mapping
  const EPS = 1e-6, GAMMA = 1.25;
  const weightFromRadius01 = (r: number) => {
    if (r >= R_ACTIVE) return 0;
    const u = clamp(r / R_ACTIVE, 0, 1);
    const base01 = 1 - Math.pow(u, GAMMA);
    return r <= EPS ? 1 : Math.min(base01, 0.9995);
  };

  // --- Visual easing
  const SMOOTH = 0.25;
  const tickRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const layoutFromVisualWeights = (dragging: ShapeKey | null, pointer?: {x:number,y:number} | null) => {
    const nextPos: typeof pos = { ...posRef.current };
    const deactivated = deactivatedRef.current;

    (['triangle', 'circle', 'square', 'diamond'] as ShapeKey[]).forEach(k => {
      if (deactivated.has(k) && dragging !== k) {
        const rPinned = maxRadiusFor(k);
        const thetaCurrent = angleRef.current[k];
        nextPos[k] = pointOnCircle(half, thetaCurrent, rPinned);
        return;
      }

      const w01 = clamp(visualWRef.current[k], 0, 1);
      const rFromW = (1 - w01) * R_ACTIVE;
      const rClamped = Math.min(rFromW, maxRadiusFor(k));

      if (dragging === k && pointer) {
        const dx = pointer.x - half, dy = pointer.y - half;
        const rRaw = Math.hypot(dx, dy);
        const rDrag = Math.min(rRaw, maxRadiusFor(k));
        const theta = Math.atan2(dy, dx);
        angleRef.current[k] = theta;
        nextPos[k] = pointOnCircle(half, theta, rDrag);
      } else {
        const thetaCurrent = angleRef.current[k];
        nextPos[k] = pointOnCircle(half, thetaCurrent, rClamped);
      }
    });

    posRef.current = nextPos;
    commitPos();
  };

  const runVisualLerp = () => {
    if (tickRef.current != null) return;
    const step = () => {
      tickRef.current = null;
      const keys = ['triangle', 'circle', 'square', 'diamond'] as ShapeKey[];
      let anyChange = false;
      const dragging = draggingRef.current;

      const VW = { ...visualWRef.current };
      const TW = { ...weightsRef.current };
      const deactivated = deactivatedRef.current;

      deactivated.forEach(k => { TW[k] = 0; VW[k] = 0; });

      for (const k of keys) {
        const target = clamp(TW[k], 0, 1);
        if (dragging === k) {
          if (VW[k] !== target) { VW[k] = target; anyChange = true; }
        } else {
          const next = VW[k] + (target - VW[k]) * SMOOTH;
          if (Math.abs(next - VW[k]) > 1e-4) { VW[k] = next; anyChange = true; }
          else if (Math.abs(VW[k] - target) > 1e-3) { VW[k] = target; anyChange = true; }
        }
      }

      if (anyChange) {
        visualWRef.current = VW;
        layoutFromVisualWeights(dragging, lastPointerRef.current);
        bump(t => t + 1);
        tickRef.current = requestAnimationFrame(step);
      }
    };
    tickRef.current = requestAnimationFrame(step);
  };

  // --- Group distribute helper (SKIPS deactivated shapes)
  const addToGroup = (W: Weights, keys: ShapeKey[], delta: number, deactivated: Set<ShapeKey>) => {
    const pool = keys.filter(k => !deactivated.has(k));
    if (Math.abs(delta) < 1e-9 || pool.length === 0) return 0;

    if (delta > 0) {
      let remaining = delta;
      while (remaining > 1e-9) {
        const open = pool.filter(k => W[k] < 1 - 1e-9);
        if (!open.length) break;
        const share = remaining / open.length;
        let progressed = 0;
        for (const k of open) {
          const room = 1 - W[k];
          const add = Math.min(share, room);
          W[k] += add; progressed += add;
        }
        if (progressed <= 1e-9) break;
        remaining -= progressed;
      }
      return delta;
    } else {
      let remaining = -delta;
      while (remaining > 1e-9) {
        const open = pool.filter(k => W[k] > 1e-9);
        if (!open.length) break;
        const share = remaining / open.length;
        let progressed = 0;
        for (const k of open) {
          const room = W[k];
          const sub = Math.min(share, room);
          W[k] -= sub; progressed += sub;
        }
        if (progressed <= 1e-9) break;
        remaining -= progressed;
      }
      return -delta;
    }
  };

  // --- Pointer drag integration
  const { start } = usePointerDrag();

  const handleMove = (ev: PointerEvent) => {
    const dragging = draggingRef.current;
    const svg = svgRef.current;
    if (!dragging || !svg) return;

    // Keep highlight while dragging
    try { onDragHover?.(dragging); } catch {}

    const p = clientToSvg(svg, ev.clientX, ev.clientY);
    lastPointerRef.current = p;

    const dx = p.x - half, dy = p.y - half;
    const rRaw = Math.hypot(dx, dy);
    const theta = Math.atan2(dy, dx);
    angleRef.current[dragging] = theta;

    const wDrag = weightFromRadius01(rRaw);

    const nextW: Weights = { ...weightsRef.current };
    const deactivated = new Set(deactivatedRef.current);

    if (wDrag >= REACTIVATE_EPS) deactivated.delete(dragging);
    if (wDrag <= DEACTIVATE_EPS) deactivated.add(dragging);

    if (activeSetOf(deactivated).length === 0) {
      deactivated.delete(dragging);
    }

    nextW[dragging] = wDrag;

    const all = ['triangle', 'circle', 'square', 'diamond'] as ShapeKey[];
    const actives = activeSetOf(deactivated);

    deactivated.forEach(k => { visualWRef.current[k] = 0; });

    if (actives.length === 1) {
      const sole = actives[0];
      deactivated.delete(sole);
      all.forEach(k => { nextW[k] = (k === sole) ? 1 : 0; });

      weightsRef.current = nextW;
      deactivatedRef.current = deactivated;
      visualWRef.current[sole] = 1;
      all.filter(k => k !== sole).forEach(k => (visualWRef.current[k] = 0));

      layoutFromVisualWeights(null, null);
      runVisualLerp();
      fireWeights(nextW);
      return;
    }

    const dynamicCap = Math.max(MIN_BUCKET_CAP, BASE_BUCKET_CAP - CAP_STEP_PER_DEACTIVATED * deactivated.size);
    const currentSum = all.reduce((a, k) => a + nextW[k], 0);
    const need = dynamicCap - currentSum;

    const others = all.filter(k => k !== dragging);
    addToGroup(nextW, others as ShapeKey[], need, deactivated);

    all.forEach(k => {
      if (deactivated.has(k)) nextW[k] = 0;
      else nextW[k] = clamp(nextW[k], 0, 1);
    });

    weightsRef.current = nextW;
    deactivatedRef.current = deactivated;

    layoutFromVisualWeights(dragging, p);

    runVisualLerp();
    fireWeights(nextW);
  };

  const handleEnd = (_ev: PointerEvent) => {
    draggingRef.current = null;
    // Clear drag highlight on release (hover will take over if applicable)
    try { onDragHover?.(undefined); } catch {}
    runVisualLerp();
  };

  const onDown = (key: ShapeKey) => (e: React.PointerEvent<SVGGElement>) => {
    if (!svgRef.current) return;
    e.preventDefault();
    draggingRef.current = key;
    // Immediately highlight the shape being grabbed
    try { onDragHover?.(key); } catch {}
    start(svgRef.current, e, handleMove, handleEnd);
  };

  // --- weights callback (rounded emission + rounded logs)
  const lastWeightsKeyRef = useRef<string | null>(null);
  const fireWeights = (W: Weights, force = false) => {
    const s = JSON.stringify(W);
    if (force || s !== lastWeightsKeyRef.current) {
      lastWeightsKeyRef.current = s;
      const rounded = Object.fromEntries(
        Object.entries(W).map(([k, v]) => [k, Number((v as number).toFixed(2))])
      ) as Weights;
      onWeightsChange?.(rounded);
    }
  };

  // --- init + cleanup
  useEffect(() => {
    deactivatedRef.current = new Set();
    layoutFromVisualWeights(null, null);
    fireWeights(weightsRef.current, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeScale]);

  // --- colors
  const SHAPE_COLORS: Record<ShapeKey, string> = {
    triangle: '#F4A42F',
    circle:   '#4498E6',
    square:   '#64B883',
    diamond:  '#9E82F1',
  };
  const OUTER_GRAY = '#6f7781';
  const colorFor = useMemo(() => colorForFactory(OUTER_GRAY, SHAPE_COLORS), []);

  // --- ring + triangle geometry
  const triPoints = useMemo(() => triPointsPath(TRI_R), [TRI_R]);
  const makeRingPath = (outerR: number, innerR: number) => makeRingPathRaw(half, outerR, innerR);

  return {
    // sizes
    sizeViewBox: size,
    half, inset, R, OUTER_R, R_ACTIVE,
    // responsive metrics
    TRI_R, CIR_R, SQR_S, DM_S,
    // refs
    svgRef,
    // visuals/state
    pos: posRef.current,
    VW: visualWRef.current,
    triPoints,
    makeRingPath,
    colorFor,
    easeFn,
    // handlers
    onDown,
  };
}
