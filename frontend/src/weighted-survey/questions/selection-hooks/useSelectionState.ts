import { useEffect, useMemo, useRef, useState } from 'react';
import {
  calcRadii,
  pointOnCircle,
  clientToSvg,
  makeRingPath as makeRingPathRaw,
  triPointsPath,
} from './geometry.ts';
import { usePointerDrag } from './usePointerDrag.ts';
import { clamp, easeFn, colorForFactory } from './colors.ts';

type ShapeKey = 'triangle' | 'circle' | 'square' | 'diamond';
type Weights = Record<ShapeKey, number>;

const BASE_TRI_R = 28, BASE_CIR_R = 26, BASE_SQR_S = 44, BASE_DM_S = 44;
const MARGIN_EXTRA = 2;

/** Thresholds */
const DEACTIVATE_EPS = 0.02;
const REACTIVATE_EPS = 0.06;

/** Capacity model (golden rule) */
const BASE_BUCKET_CAP = 2.5;          // all 4 active
const CAP_STEP_PER_DEACTIVATED = 0.5; // each deactivated lowers cap by 0.5
const MIN_BUCKET_CAP = 1.0;           // with 1 active, cap is 1.0

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
  onDragHover,
}: {
  size: number;
  onWeightsChange?: (weights: Weights) => void;
  onDragHover?: (shape?: ShapeKey) => void;
}) {
  const shapeScale = useShapeScale();

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

  /** Visual spacing: keep an inner pad so shapes don’t bunch at the center */
  const R_INNER = Math.max(12, R_ACTIVE * 0.22); // tweak 0.18–0.30 to taste
  const R_SPAN  = Math.max(1, R_ACTIVE - R_INNER);

  // 45° rotated cross
  const ANGLES: Record<ShapeKey, number> = {
    circle:   -Math.PI / 4,
    square:    (3 * Math.PI) / 4,
    triangle:   Math.PI / 4,
    diamond:   -(3 * Math.PI) / 4,
  };

  const makeInitialPos = () => {
    // Equal distribution with 4 active => 2.5 / 4 = 0.625 each
    const baseWeight = BASE_BUCKET_CAP / 4; // 0.625
    // map weight -> radius over [R_INNER, R_ACTIVE]
    const rMid = R_INNER + (1 - baseWeight) * R_SPAN;
    const res = {} as Record<ShapeKey, { x: number; y: number }>;
    (['triangle', 'circle', 'square', 'diamond'] as ShapeKey[]).forEach((k) => {
      const r = Math.min(rMid, maxRadiusFor(k));
      res[k] = pointOnCircle(half, ANGLES[k], r);
    });
    return res;
  };

  const initialPos: Record<ShapeKey, { x: number; y: number }> = makeInitialPos();

  const [pos, setPos] = useState(initialPos);
  const posRef = useRef(pos);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef<ShapeKey | null>(null);
  const frameRef = useRef<number | null>(null);

  const weightsRef = useRef<Weights>({
    triangle: BASE_BUCKET_CAP / 4,
    circle:   BASE_BUCKET_CAP / 4,
    square:   BASE_BUCKET_CAP / 4,
    diamond:  BASE_BUCKET_CAP / 4,
  });
  const visualWRef = useRef<Weights>({ ...weightsRef.current });
  const [, bump] = useState(0);

  const angleRef = useRef<Record<ShapeKey, number>>({
    triangle: ANGLES.triangle,
    circle:   ANGLES.circle,
    square:   ANGLES.square,
    diamond:  ANGLES.diamond,
  });

  /** Only user actions (drag/slider) change this */
  const deactivatedRef = useRef<Set<ShapeKey>>(new Set());

  const commitPos = () => {
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setPos(posRef.current);
    });
  };

  const EPS = 1e-6, GAMMA = 1.25;

  /** radius -> weight with inner pad */
  const weightFromRadius01 = (r: number) => {
    const rAdj = Math.max(0, Math.min(r - R_INNER, R_SPAN)); // [0..R_SPAN]
    const u = clamp(rAdj / R_SPAN, 0, 1);
    const base01 = 1 - Math.pow(u, GAMMA);
    return r <= R_INNER + EPS ? 1 : Math.min(base01, 0.9995);
  };

  const SMOOTH = 0.25;
  const tickRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const activeKeys = (deactivated: Set<ShapeKey>) =>
    (['triangle', 'circle', 'square', 'diamond'] as ShapeKey[]).filter(k => !deactivated.has(k));

  /** weight -> radius with inner pad */
  const layoutFromVisualWeights = (dragging: ShapeKey | null, pointer?: {x:number,y:number} | null) => {
    const nextPos: typeof pos = { ...posRef.current };
    const deactivated = deactivatedRef.current;

    (['triangle', 'circle', 'square', 'diamond'] as ShapeKey[]).forEach(k => {
      if (deactivated.has(k) && dragging !== k) {
        const thetaCurrent = angleRef.current[k];
        const rPinned = maxRadiusFor(k);
        nextPos[k] = pointOnCircle(half, thetaCurrent, rPinned);
        return;
      }

      const w01 = clamp(visualWRef.current[k], 0, 1);
      const rFromW = R_INNER + (1 - w01) * R_SPAN;
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

  // Even distribution helper
  const distributeEven = (W: Weights, targets: ShapeKey[], amount: number) => {
    if (amount <= 1e-9 || targets.length === 0) return 0;
    let remaining = amount;
    let open = targets.slice();
    while (remaining > 1e-9 && open.length > 0) {
      const share = remaining / open.length;
      let progressed = 0;
      const stillOpen: ShapeKey[] = [];
      for (const k of open) {
        const room = 1 - W[k];
        const add = Math.min(share, room);
        W[k] += add;
        progressed += add;
        if (W[k] < 1 - 1e-9) stillOpen.push(k);
      }
      if (progressed <= 1e-9) break;
      remaining -= progressed;
      open = stillOpen;
    }
    return amount - remaining;
  };

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

  const dynamicCapFor = (deactivated: Set<ShapeKey>) =>
    Math.max(MIN_BUCKET_CAP, BASE_BUCKET_CAP - CAP_STEP_PER_DEACTIVATED * deactivated.size);

  const { start } = usePointerDrag();

  const handleMove = (ev: PointerEvent) => {
    const dragging = draggingRef.current;
    const svg = svgRef.current;
    if (!dragging || !svg) return;

    try { onDragHover?.(dragging); } catch {}

    const p = clientToSvg(svg, ev.clientX, ev.clientY);
    lastPointerRef.current = p;

    const dx = p.x - half, dy = p.y - half;
    const rRaw = Math.hypot(dx, dy);
    const theta = Math.atan2(dy, dx);
    angleRef.current[dragging] = theta;

    let wDrag = weightFromRadius01(rRaw);

    const nextW: Weights = { ...weightsRef.current };
    const deactivated = new Set(deactivatedRef.current);

    const actives = activeKeys(deactivated);

    // De/activate with last-active guard
    if (wDrag <= DEACTIVATE_EPS) {
      if (actives.length <= 1 && !deactivated.has(dragging)) {
        wDrag = 1.0; // the last active must remain at full normalized capacity
      } else {
        deactivated.add(dragging);
        wDrag = 0;
      }
    } else if (wDrag >= REACTIVATE_EPS) {
      deactivated.delete(dragging);
    }

    nextW[dragging] = wDrag;

    // Capacity over ACTIVE shapes
    const cap0 = dynamicCapFor(deactivated);
    const sum0 = (['triangle', 'circle', 'square', 'diamond'] as ShapeKey[])
      .reduce((a, k) => a + (deactivated.has(k) ? 0 : nextW[k]), 0);
    let need = cap0 - sum0;

    const others = (['triangle', 'circle', 'square', 'diamond'] as ShapeKey[]).filter(k => k !== dragging);

    // Fill among active others
    let used = addToGroup(nextW, others as ShapeKey[], need, deactivated);
    need -= used;

    // If only one active and user drags it below 1, reactivate all 3 and split equally
    if (activeKeys(deactivated).length === 1 && need > 1e-6) {
      const reTargets: ShapeKey[] = others.filter(k => deactivated.has(k)) as ShapeKey[];
      if (reTargets.length) {
        reTargets.forEach(k => { deactivated.delete(k); nextW[k] = 0; });
        const cap1 = dynamicCapFor(deactivated);
        const sum1 = (['triangle', 'circle', 'square', 'diamond'] as ShapeKey[])
          .reduce((a, kk) => a + (deactivated.has(kk) ? 0 : nextW[kk]), 0);
        let need1 = cap1 - sum1;
        distributeEven(nextW, reTargets, need1);
        need = 0;
      }
    }

    (['triangle', 'circle', 'square', 'diamond'] as ShapeKey[]).forEach(k => {
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
    try { onDragHover?.(undefined); } catch {}
    runVisualLerp();
  };

  const onDown = (key: ShapeKey) => (e: React.PointerEvent<SVGGElement>) => {
    if (!svgRef.current) return;
    e.preventDefault();
    draggingRef.current = key;
    try { onDragHover?.(key); } catch {}
    start(svgRef.current, e, handleMove, handleEnd);
  };

  // Programmatic set from list sliders (two-way); sliders can (re)activate shapes.
  const setWeight = (shape: ShapeKey, weight01: number) => {
    let w = clamp(weight01, 0, 1);
    const nextW: Weights = { ...weightsRef.current };
    const deactivated = new Set(deactivatedRef.current);

    // Guard: can't deactivate the last active
    if (w <= DEACTIVATE_EPS && !deactivated.has(shape) && activeKeys(deactivated).length <= 1) {
      w = 1.0;
    }

    if (w >= REACTIVATE_EPS) deactivated.delete(shape);
    if (w <= DEACTIVATE_EPS && !deactivated.has(shape) && activeKeys(deactivated).length > 1) {
      deactivated.add(shape);
      w = 0;
    }

    nextW[shape] = w;

    const cap0 = dynamicCapFor(deactivated);
    const sum0 = (['triangle', 'circle', 'square', 'diamond'] as ShapeKey[])
      .reduce((a, k) => a + (deactivated.has(k) ? 0 : nextW[k]), 0);
    let need = cap0 - sum0;

    const others = (['triangle', 'circle', 'square', 'diamond'] as ShapeKey[]).filter(k => k !== shape);
    let used = addToGroup(nextW, others as ShapeKey[], need, deactivated);
    need -= used;

    if (activeKeys(deactivated).length === 1 && need > 1e-6) {
      const reTargets: ShapeKey[] = others.filter(k => deactivated.has(k)) as ShapeKey[];
      if (reTargets.length) {
        reTargets.forEach(k => { deactivated.delete(k); nextW[k] = 0; });
        const cap1 = dynamicCapFor(deactivated);
        const sum1 = (['triangle', 'circle', 'square', 'diamond'] as ShapeKey[])
          .reduce((a, kk) => a + (deactivated.has(kk) ? 0 : nextW[kk]), 0);
        let need1 = cap1 - sum1;
        distributeEven(nextW, reTargets, need1);
        need = 0;
      }
    }

    (['triangle', 'circle', 'square', 'diamond'] as ShapeKey[]).forEach(k => {
      if (deactivated.has(k)) nextW[k] = 0;
      else nextW[k] = clamp(nextW[k], 0, 1);
    });

    weightsRef.current = nextW;
    deactivatedRef.current = deactivated;

    layoutFromVisualWeights(null, null);
    runVisualLerp();
    fireWeights(nextW);
  };

  // Reset to the per-question initial layout when the question changes.
  useEffect(() => {
    const reset = () => {
      // reset angles
      angleRef.current = {
        triangle: ANGLES.triangle,
        circle:   ANGLES.circle,
        square:   ANGLES.square,
        diamond:  ANGLES.diamond,
      };
      // reset positions
      posRef.current = makeInitialPos();
      // reset activation & equal weights
      deactivatedRef.current = new Set();
      weightsRef.current = {
        triangle: BASE_BUCKET_CAP / 4,
        circle:   BASE_BUCKET_CAP / 4,
        square:   BASE_BUCKET_CAP / 4,
        diamond:  BASE_BUCKET_CAP / 4,
      };
      visualWRef.current = { ...weightsRef.current };
      commitPos();
      fireWeights(weightsRef.current, true);
    };
    const handler = () => reset();
    window.addEventListener('gp:question-changed', handler as EventListener);
    return () => window.removeEventListener('gp:question-changed', handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [R_INNER, R_SPAN]); // if spacing changes, next question reset matches it

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

  // Recompute layout on size/scale change
  useEffect(() => {
    layoutFromVisualWeights(null, null);
    fireWeights(weightsRef.current, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeScale]);

  const SHAPE_COLORS: Record<ShapeKey, string> = {
    triangle: '#F4A42F',
    circle:   '#4498E6',
    square:   '#64B883',
    diamond:  '#9E82F1',
  };
  const OUTER_GRAY = '#6f7781';
  const colorFor = useMemo(() => colorForFactory(OUTER_GRAY, SHAPE_COLORS), []);

  const triPoints = useMemo(() => triPointsPath(TRI_R), [TRI_R]);
  const makeRingPath = (outerR: number, innerR: number) => makeRingPathRaw(half, outerR, innerR);

  return {
    sizeViewBox: size,
    half, inset, R, OUTER_R, R_ACTIVE,
    TRI_R, CIR_R, SQR_S, DM_S,
    svgRef,
    pos: posRef.current,
    VW: visualWRef.current,
    triPoints,
    makeRingPath,
    colorFor,
    easeFn,
    onDown,
    setWeight,
  };
}
