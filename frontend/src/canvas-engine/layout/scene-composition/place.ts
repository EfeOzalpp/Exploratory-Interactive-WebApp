// src/canvas/layout/scene-composition/place.ts
import { createOccupancy } from '../grid-layout/occupancy.ts';
import { cellCenterToPx } from '../grid-layout/coords.ts';
import { RowRules } from '../grid-layout/rowRules.ts';
import type { BreakBand, GridSpec } from '../grid-layout/config.ts';

import type { PoolItem, PlacedItem, FootRect } from './types.ts';
import { buildFallbackCells } from './candidates.ts';
import { cellForbiddenFromSpec, allowedSegmentsForRow, footprintAllowed } from './constraints.ts';
import { isSky, scoreSkyCandidate } from './scoringSky.ts';
import { rowOrderFromBand, pickLane, scoreGroundCandidate } from './scoringGround.ts';

function isGroundSpecial(shape?: PoolItem['shape']) {
  return shape === 'house' || shape === 'villa' || shape === 'power' || shape === 'car';
}

export function placePoolItems(opts: {
  pool: PoolItem[];
  spec: GridSpec;
  band: BreakBand;
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
    band,
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

  const placedAccum: Array<{ id: number; x: number; y: number; shape?: PoolItem['shape']; footprint: FootRect }> = [];
  const outPlaced: PlacedItem[] = [];

  let cursor = 0;

  for (let i = 0; i < nextPool.length; i++) {
    const item = nextPool[i];
    if (!item.size) continue;

    const wCell = item.size.w;
    const hCell = item.size.h;

    let rectHit: FootRect | null = null;

    if (isGroundSpecial(item.shape)) {
      const isHouse = item.shape === 'house';
      const lane = item.shape === 'house' || item.shape === 'villa' ? pickLane(isHouse ? 'house' : 'villa', item.id, salt) : null;

      const { top: bandTop, bot: bandBot } = RowRules.preferredGroundBand(
        item.shape,
        usedRows,
        band,
        hCell,
        { questionnaire: questionnaireOpen, overlay }
      );

      const rowOrder = rowOrderFromBand(bandTop, bandBot);

      const candidates: Array<{ r0: number; c0: number; score: number }> = [];

      for (const r0 of rowOrder) {
        if (r0 < bandTop || r0 + hCell - 1 > bandBot) continue;

        const segs = allowedSegmentsForRow(r0, wCell, hCell, rows, cols, isForbidden);
        for (const seg of segs) {
          const segCenterC = (seg.cStart + seg.cEnd + wCell) / 2;
          for (let c0 = seg.cStart; c0 <= seg.cEnd; c0++) {
            const score = scoreGroundCandidate(
              cols,
              usedRows,
              r0,
              c0,
              wCell,
              hCell,
              lane,
              segCenterC,
              bandTop,
              bandBot,
              item.shape,
              { centerBias: !overlay, segPull: !overlay }
            );
            candidates.push({ r0, c0, score });
          }
        }
      }

      if (candidates.length === 0) {
        const pad = 2;
        const fTop = Math.max(0, bandTop - pad);
        const fBot = Math.min(rows - hCell, bandBot + pad);

        for (let r0 = fTop; r0 <= fBot; r0++) {
          const segs = allowedSegmentsForRow(r0, wCell, hCell, rows, cols, isForbidden);
          for (const seg of segs) {
            const segCenterC = (seg.cStart + seg.cEnd + wCell) / 2;
            for (let c0 = seg.cStart; c0 <= seg.cEnd; c0++) {
              const score = scoreGroundCandidate(
                cols,
                usedRows,
                r0,
                c0,
                wCell,
                hCell,
                lane,
                segCenterC,
                bandTop,
                bandBot,
                item.shape,
                { centerBias: !overlay, segPull: !overlay }
              ) - 4;
              candidates.push({ r0, c0, score });
            }
          }
        }
      }

      candidates.sort((a, b) => b.score - a.score);

      for (const cand of candidates) {
        const hit = occ.tryPlaceAt(cand.r0, cand.c0, wCell, hCell);
        if (hit) {
          rectHit = hit;
          break;
        }
      }
    } else {
      const { rMin, rMax } = RowRules.skyBand(item.shape, usedRows, band, {
        questionnaire: questionnaireOpen,
        overlay,
      });

      const placedSky = placedAccum
        .filter((p) => isSky(p.shape))
        .map((p) => ({
          r0: p.footprint.r0,
          c0: p.footprint.c0,
          w: p.footprint.w,
          h: p.footprint.h,
        }));

      const skyCandidates: Array<{ r0: number; c0: number; score: number }> = [];

      for (let r0 = rMin; r0 <= Math.min(rMax, rows - hCell); r0++) {
        const segs = allowedSegmentsForRow(r0, wCell, hCell, rows, cols, isForbidden);
        for (const seg of segs) {
          for (let c0 = seg.cStart; c0 <= seg.cEnd; c0++) {
            const score = scoreSkyCandidate(
              r0,
              c0,
              wCell,
              hCell,
              rows,
              cols,
              usedRows,
              placedSky,
              salt,
              !overlay
            );
            skyCandidates.push({ r0, c0, score });
          }
        }
      }

      if (skyCandidates.length === 0) {
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
        skyCandidates.sort((a, b) => b.score - a.score);
        for (const cand of skyCandidates) {
          const hit = occ.tryPlaceAt(cand.r0, cand.c0, wCell, hCell);
          if (hit) {
            rectHit = hit;
            break;
          }
        }
      }
    }

    if (!rectHit) continue;

    const cr = rectHit.r0 + Math.floor(rectHit.h / 2);
    const cc = rectHit.c0 + Math.floor(rectHit.w / 2);

    let { x, y } = cellCenterToPx(cell, cr, cc);

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
