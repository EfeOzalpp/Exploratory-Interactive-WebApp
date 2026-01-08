// src/canvas/scene-logic/place.ts

import { createOccupancy } from '../grid-layout/occupancy.ts';
import { cellCenterToPx } from '../grid-layout/coords.ts';
import { PlacementBands } from '../grid-layout/placementBands.ts';
import type { DeviceType } from '../shared/utils/responsiveness.ts';
import type { CanvasPaddingSpec } from '../shared/scene-schema/canvasPadding.ts';

import type { PoolItem, PlacedItem, FootRect } from './types.ts';
import { buildFallbackCells } from './candidates.ts';
import { cellForbiddenFromSpec, allowedSegmentsForRow, footprintAllowed } from './constraints.ts';
import type { ShapeName } from '../shared/scene-schema/shapeCatalog.ts';
import { scoreCandidateGeneric } from './scoring.ts';

export function placePoolItems(opts: {
  pool: PoolItem[];
  spec: CanvasPaddingSpec;
  device: DeviceType;
  rows: number;
  cols: number;
  cell: number;
  usedRows: number;
  salt: number;
  questionnaireOpen: boolean;
  overlay: boolean;
}): { placed: PlacedItem[]; nextPool: PoolItem[] } {
  const {
    pool,
    spec,
    device,
    rows,
    cols,
    cell,
    usedRows,
    salt,
    questionnaireOpen,
    overlay,
  } = opts;

  const isForbidden = cellForbiddenFromSpec(spec, rows, cols);

  const occ = createOccupancy(rows, cols, (r, c) => isForbidden(r, c));

  const fallbackCells = buildFallbackCells(rows, cols, spec, { overlay });

  const nextPool: PoolItem[] = pool.map((p) => ({
    ...p,
    footprint: undefined,
    x: undefined,
    y: undefined,
  }));

  const placedAccum: Array<{
    id: number;
    x: number;
    y: number;
    shape?: PoolItem['shape'];
    footprint: FootRect;
  }> = [];

  const outPlaced: PlacedItem[] = [];

  let cursor = 0;

  for (let i = 0; i < nextPool.length; i++) {
    const item = nextPool[i];
    if (!item.size) continue;

    const wCell = item.size.w;
    const hCell = item.size.h;

    let rectHit: FootRect | null = null;

    const shape = item.shape as ShapeName | undefined;

    // One band API for everything (height-aware clamping)
    const { top: rMin, bot: rMax } = PlacementBands.band(
      shape,
      usedRows,
      device,
      hCell,
      { questionnaire: questionnaireOpen, overlay }
    );

    // already-placed footprints (passed into scoring for spacing / heuristics)
    const placedForSep = placedAccum.map((p) => ({
      r0: p.footprint.r0,
      c0: p.footprint.c0,
      w: p.footprint.w,
      h: p.footprint.h,
      shape: p.shape as ShapeName | undefined,
    }));

    const candidates: Array<{ r0: number; c0: number; score: number }> = [];

    for (let r0 = rMin; r0 <= Math.min(rMax, rows - hCell); r0++) {
      const segs = allowedSegmentsForRow(r0, wCell, hCell, rows, cols, isForbidden);
      for (const seg of segs) {
        for (let c0 = seg.cStart; c0 <= seg.cEnd; c0++) {
          const score = scoreCandidateGeneric({
            r0,
            c0,
            wCell,
            hCell,
            cols,
            usedRows,
            placed: placedForSep,
            salt,
            shape,
            centerBias: !overlay,
          });
          candidates.push({ r0, c0, score });
        }
      }
    }

    if (candidates.length === 0) {
      for (let k = cursor; k < fallbackCells.length; k++) {
        const { r, c } = fallbackCells[k];

        if (r < rMin || r > rMax) continue;
        if (!footprintAllowed(r, c, wCell, hCell, rows, cols, isForbidden)) continue;

        const hit = occ.tryPlaceAt(r, c, wCell, hCell);
        if (hit) {
          rectHit = hit;
          cursor = Math.max(k - 2, 0);
          break;
        }
      }
    } else {
      candidates.sort((a, b) => b.score - a.score);
      for (const cand of candidates) {
        const hit = occ.tryPlaceAt(cand.r0, cand.c0, wCell, hCell);
        if (hit) {
          rectHit = hit;
          break;
        }
      }
    }

    // Critical: if nothing fit, skip item safely
    if (!rectHit) continue;

    const cr = rectHit.r0 + Math.floor(rectHit.h / 2);
    const cc = rectHit.c0 + Math.floor(rectHit.w / 2);

    let { x, y } = cellCenterToPx(cell, cr, cc);

    // keep your special-case for sun
    if (item.shape === 'sun') {
      x = (rectHit.c0 + rectHit.w / 2) * cell;
      y = (rectHit.r0 + rectHit.h / 2) * cell;
    }

    item.footprint = rectHit;
    item.x = x;
    item.y = y;

    placedAccum.push({ id: item.id, x, y, shape: item.shape, footprint: rectHit });
    outPlaced.push({ id: item.id, x, y, shape: item.shape, footprint: rectHit });
  }

  return { placed: outPlaced, nextPool };
}
