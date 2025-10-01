// src/canvas/hooks/useGridDotField.ts
import { useEffect, useRef } from 'react';
import { bandFromWidth, GRID_MAP } from '../grid/config.ts';
import { makeCenteredSquareGrid } from '../grid/layoutCentered.ts';
import { interpolateMix20, scaleMixToCount, buildShapeSequence, type ShapeKind } from '../shapeMix.ts';
import { createOccupancy } from '../grid/occupancy.ts';
import { cellCenterToPx } from '../grid/coords.ts';
import { SHAPE_FOOTPRINTS } from '../shapeFootprints.ts';

type Engine = { ready: React.MutableRefObject<boolean>; controls: React.MutableRefObject<any> };

const clamp01 = (v: number | undefined) =>
  typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5;

/** V-shape count: 20 at 0/1, 10 at 0.5 (range 10..20, integer) */
function itemCountFromAvg(avg: number | undefined, cap = 20) {
  const t = clamp01(avg);
  const v = 10 + 20 * Math.abs(t - 0.5); // 10..20
  return Math.max(1, Math.min(cap, Math.round(v)));
}

/** Deterministically pick a footprint option by index (no RNG) */
function chooseFootprint(shape: ShapeKind, i: number) {
  const spec = SHAPE_FOOTPRINTS[shape];
  if (Array.isArray(spec)) return spec[i % spec.length];
  return spec;
}

/** Row-major candidates (top→bottom, left→right), stable scan */
function buildCandidates(rows: number, cols: number) {
  const out: Array<{ r: number; c: number }> = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ r, c });
  return out;
}

/**
 * Computes K items with shapes (ids 1..K) and footprints, blocks overlaps, and
 * sends them via field API:
 *   controls.setFieldItems([{ id, x, y, shape, footprint }])
 * Styling is external (useColor/useShapeFromAvg).
 */
export function useGridDotField(
  engine: Engine,
  liveAvg: number | undefined,
  opts: { cap?: number } = {}
) {
  const { cap = 20 } = opts;
  const avgRef = useRef(clamp01(liveAvg));
  avgRef.current = clamp01(liveAvg);

  useEffect(() => {
    if (!engine?.ready?.current) return;

    const canvas = engine.controls.current?.canvas;
    const rect = canvas?.getBoundingClientRect?.();
    const w = Math.round(rect?.width ?? window.innerWidth);
    const h = Math.round(rect?.height ?? window.innerHeight);

    const spec = GRID_MAP[bandFromWidth(w)];
    const { cell, rows, cols } = makeCenteredSquareGrid({
      w, h,
      rows: spec.rows,
      useTopRatio: spec.useTopRatio ?? 1,
    });
    if (!rows || !cols) {
      engine.controls.current?.setFieldItems?.([]);
      return;
    }

    // --- how many items
    const K = itemCountFromAvg(avgRef.current, cap);           // 10..20

    // --- which shapes (round-robin sequence, e.g. [circle, oct, square, ...])
    const float20 = interpolateMix20(avgRef.current);
    const [cCnt, tCnt, sCnt, oCnt] = scaleMixToCount(float20, K);
    const seq: ShapeKind[] = buildShapeSequence([cCnt, tCnt, sCnt, oCnt]); // length K

    // --- occupancy layout
    const occ = createOccupancy(rows, cols);
    const candidates = buildCandidates(rows, cols);

    const placed: Array<{
      id: number;
      x: number; y: number;
      shape: ShapeKind;
      footprint: { r0: number; c0: number; w: number; h: number };
    }> = [];

    let cursor = 0; // scan index to keep placement stable
    for (let i = 0; i < seq.length; i++) {
      const shape = seq[i];
      const fp = chooseFootprint(shape, i); // e.g., square might be 1x1 then 2x1 alternating

      let placedThis = null as null | { r0: number; c0: number; w: number; h: number };
      for (let k = cursor; k < candidates.length; k++) {
        const { r, c } = candidates[k];
        const hit = occ.tryPlaceAt(r, c, fp.w, fp.h);
        if (hit) {
          placedThis = hit;
          cursor = k; // continue scanning from here (stable)
          break;
        }
      }
      if (!placedThis) continue; // skip if we can't place (rare at K<=20)

      // center of the footprint (roughly middle cell)
      const cr = placedThis.r0 + Math.floor(placedThis.h / 2);
      const cc = placedThis.c0 + Math.floor(placedThis.w / 2);
      const { x, y } = cellCenterToPx(cell, cr, cc);

      placed.push({
        id: i + 1,                       // stable id 1..K
        x, y,
        shape,
        footprint: placedThis,
      });
    }

    engine.controls.current?.setFieldItems?.(placed);
    engine.controls.current?.setFieldVisible?.(true);
  }, [engine, liveAvg, cap]);
}
