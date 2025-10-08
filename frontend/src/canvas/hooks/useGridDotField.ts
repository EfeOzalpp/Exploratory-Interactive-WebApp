// src/canvas/hooks/useGridDotField.ts
import { useEffect, useRef } from 'react';
import { bandFromWidth, GRID_MAP, type GridSpec } from '../grid/config.ts';
import { makeCenteredSquareGrid } from '../grid/layoutCentered.ts';
import { createOccupancy } from '../grid/occupancy.ts';
import { cellCenterToPx } from '../grid/coords.ts';

import type { ConditionKind } from '../condition/conditionMix.ts';
import {
  interpolateConditionMix20,
  scaleMixToCount,
  adjustConditionsStable,
} from '../condition/conditionMix.ts';

import { CONDITIONS } from '../condition/conditions.ts';
import { RowRules } from './rowRules.ts';

// NEW: bring in planner helpers
import {
  planForBucket,
  type PoolItem as PlannerPoolItem,
  type ShapeName,
  type Size,
} from '../condition/conditionPlanner.ts';

type FootRect = { r0: number; c0: number; w: number; h: number };

// Extend the planner item for this hook:
type PoolItem = PlannerPoolItem & {
  shape?: ShapeName;
  size?: Size;
  footprint?: FootRect;
  x?: number;
  y?: number;
};

type Engine = { ready: React.MutableRefObject<boolean>; controls: React.MutableRefObject<any> };

const POOL_SIZE = 24;
const clamp01 = (v?: number) => (typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5);

/** Center-clumped candidate ordering within the usable top region. */
function buildCandidates(rows: number, cols: number, spec: GridSpec) {
  const useTop = Math.max(0.01, Math.min(1, spec.useTopRatio ?? 1));
  const usedRows = Math.max(1, Math.round(rows * useTop));
  const centerR = (usedRows - 1) / 2;
  const centerC = (cols - 1) / 2;

  const out: Array<{ r: number; c: number; d2: number }> = [];
  for (let r = 0; r < rows; r++) {
    const rInUsed = r < usedRows ? r : (usedRows - 1) + (r - usedRows + 1) * 2;
    for (let c = 0; c < cols; c++) {
      const dr = rInUsed - centerR;
      const dc = c - centerC;
      const d2 = dr * dr + dc * dc;
      out.push({ r, c, d2 });
    }
  }
  out.sort((a, b) => a.d2 - b.d2);
  return out.map(({ r, c }) => ({ r, c }));
}

type Rect = { top: number; left: number; bottom: number; right: number };

const cellInRect = (r:number,c:number,rows:number,cols:number,rect:Rect) => {
  const r0 = Math.floor(rect.top * rows), r1 = Math.ceil(rect.bottom * rows) - 1;
  const c0 = Math.floor(rect.left * cols), c1 = Math.ceil(rect.right * cols) - 1;
  return r>=r0 && r<=r1 && c>=c0 && c<=c1;
};

function cellForbidden(r:number,c:number,rows:number,cols:number,spec:GridSpec){
  if (spec.forbiddenRects) for (const rect of spec.forbiddenRects) if (cellInRect(r,c,rows,cols,rect)) return true;
  if (spec.forbidden && spec.forbidden(r,c,rows,cols)) return true;
  return false;
}

function footprintAllowed(r0:number,c0:number,w:number,h:number,rows:number,cols:number,spec:GridSpec){
  if (r0<0||c0<0||r0+h>rows||c0+w>cols) return false;
  for (let dr=0; dr<h; dr++) for (let dc=0; dc<w; dc++){
    if (cellForbidden(r0+dr,c0+dc,rows,cols,spec)) return false;
  }
  return true;
}

/* ---------------- helpers kept (no device rules here) ---------------- */

function isSky(shape?: ShapeName) {
  return shape === 'clouds' || shape === 'snow' || shape === 'sun';
}

/** Deterministic 0..1 noise keyed by a string */
function rand01Keyed(key:string) {
  const h = hash32(key);
  return ((h >>> 8) & 0xffff) / 0xffff;
}

/* ====== SKY scoring ====== */
function scoreSkyCandidate(
  r0:number, c0:number, wCell:number, hCell:number,
  rows:number, cols:number, usedRows:number,
  placedSky: Array<{r0:number; c0:number; w:number; h:number}>,
  salt:number
){
  const cx = c0 + wCell / 2;
  const cy = r0 + hCell / 2;
  const gridCx = (cols - 1) / 2;
  const usedCy = (usedRows - 1) / 2;

  const dCenter2 = (cx - gridCx) ** 2 + (cy - usedCy) ** 2;
  const centerPenalty = -0.12 * dCenter2;

  let minD2 = Infinity;
  for (const s of placedSky) {
    const sx = s.c0 + s.w / 2;
    const sy = s.r0 + s.h / 2;
    const dx = cx - sx;
    const dy = cy - sy;
    const d2 = dx*dx + dy*dy;
    if (d2 < minD2) minD2 = d2;
  }
  const spread = (placedSky.length ? Math.sqrt(minD2) : 0) * 1.2;
  const jitter = (rand01Keyed(`sky|${r0},${c0}|${salt}`) - 0.5) * 0.4;

  return spread + centerPenalty + jitter;
}

/* ---------------- Ground helpers ---------------- */

function rowOrderFromBand(top: number, bot: number) {
  if (top > bot) return [];
  const pref = Math.floor(top + (bot - top) * 0.30);
  const out: number[] = [pref];
  for (let d = 1; ; d++) {
    const up1 = pref - d;
    const up2 = pref - (d + 1);
    const dn  = pref + d;
    let pushed = false;
    if (up1 >= top) { out.push(up1); pushed = true; }
    if (up2 >= top) { out.push(up2); pushed = true; }
    if (dn  <= bot) { out.push(dn);  pushed = true; }
    if (!pushed) break;
  }
  return out;
}

/** >>> RESTORED <<< */
function allowedSegmentsForRow(
  r0:number, wCell:number, hCell:number, rows:number, cols:number, spec:GridSpec
): Array<{cStart:number; cEnd:number}> {
  const segs: Array<{cStart:number;cEnd:number}> = [];
  let c = 0;
  while (c <= cols - wCell) {
    while (c <= cols - wCell && !footprintAllowed(r0, c, wCell, hCell, rows, cols, spec)) c++;
    if (c > cols - wCell) break;
    const cStart = c;
    while (c <= cols - wCell && footprintAllowed(r0, c, wCell, hCell, rows, cols, spec)) c++;
    const cEnd = c - 1;
    segs.push({ cStart, cEnd });
  }
  return segs;
}

/* ====== GROUND scoring (band clamp + car bias) ====== */
function scoreGroundCandidate(
  _rows: number, cols: number, usedRows: number,
  r0: number, c0: number, wCell: number, hCell: number,
  lane: number | null,
  segCenterC: number,
  bandTop: number,
  bandBot: number,
  shape?: ShapeName
) {
  // HARD band clamp
  if (r0 < bandTop || (r0 + hCell - 1) > bandBot) return -1e9;

  const colCenter = c0 + wCell / 2;
  const rowCenter = r0 + hCell / 2;
  const gridColCenter = (cols - 1) / 2;
  const usedRowCenter = (usedRows - 1) / 2;

  const dCol2 = (colCenter - gridColCenter) ** 2;
  const dRow2 = (rowCenter - usedRowCenter) ** 2;

  const wCol = 1.0;
  const wRow = 0.6;

  const edgeLeft  = Math.max(0, 2 - c0);
  const edgeRight = Math.max(0, (c0 + wCell) - (cols - 2));
  const edgePenalty = (edgeLeft + edgeRight) * 6;

  const lanePenalty = (lane != null && (c0 % 3) !== lane) ? 2 : 0;
  const segPull = -0.9 * (colCenter - segCenterC) ** 2;

  const jitter = (hash32(`g|${r0},${c0},${wCell},${hCell}`) & 0xff) / 255 * 0.2;

  // cars prefer lower part of their ground band
  let carBias = 0;
  if (shape === 'car') {
    const bandBotCenter = bandBot + 0.5;
    const dist = (rowCenter - bandBotCenter);
    carBias = -0.25 * (dist * dist);
  }

  return -(wCol * dCol2 + wRow * dRow2) - lanePenalty - edgePenalty + segPull + jitter + carBias;
}

/* ---------------- Hash + misc ---------------- */

function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function pickLane(key: 'house'|'villa', id: number, salt: number) {
  return hash32(`${key}|${id}|${salt}`) % 3;
}

/* ---------------- Sun-at-low-avg helper (device-aware) ---------------- */

function ensureAtLeastOneSunAtLowAvg(
  placed: Array<{ shape?: ShapeName; footprint: FootRect }>,
  u: number,
  usedRows: number,
  band: ReturnType<typeof bandFromWidth>
) {
  if (u > 0.02) return;
  if (placed.some(it => it.shape === 'sun')) return;

  const { rMin, rMax } = RowRules.skyBand('sun', usedRows, band);

  let idx = placed.findIndex(it =>
    it.shape !== 'clouds' &&
    it.footprint?.w === 1 && it.footprint?.h === 1 &&
    it.footprint.r0 >= rMin && it.footprint.r0 <= rMax
  );

  if (idx === -1) {
    idx = placed.findIndex(it =>
      it.footprint?.w === 1 && it.footprint?.h === 1 &&
      it.footprint.r0 >= rMin && it.footprint.r0 <= rMax
    );
  }

  if (idx === -1) {
    idx = placed.findIndex(it =>
      it.shape !== 'clouds' && it.footprint?.w === 1 && it.footprint?.h === 1
    );
  }
  if (idx === -1) {
    idx = placed.findIndex(it => it.footprint?.w === 1 && it.footprint?.h === 1);
  }

  if (idx !== -1) {
    placed[idx].shape = 'sun';
    placed[idx].footprint = { ...placed[idx].footprint, w: 1, h: 1 };
  }
}

/* ---------------- Hook ---------------- */

export function useGridDotField(engine: Engine, liveAvg: number | undefined) {
  const tRef = useRef(clamp01(liveAvg));
  tRef.current = clamp01(liveAvg);

  const poolRef = useRef<PoolItem[] | null>(null);
  if (!poolRef.current) {
    poolRef.current = Array.from({ length: POOL_SIZE }, (_, i) => ({
      id: i + 1,
      cond: 'A' as ConditionKind,
    }));
  }

  useEffect(() => {
    if (!engine?.ready?.current) return;

    // viewport & grid
    const canvas = engine.controls.current?.canvas;
    const rect = canvas?.getBoundingClientRect?.();
    const w = Math.round(rect?.width ?? window.innerWidth);
    const h = Math.round(rect?.height ?? window.innerHeight);

    const band = bandFromWidth(w);
    const spec = GRID_MAP[band];
    const { cell, rows, cols } = makeCenteredSquareGrid({
      w, h, rows: spec.rows, useTopRatio: spec.useTopRatio ?? 1,
    });
    if (!rows || !cols || !cell) {
      engine.controls.current?.setFieldVisible?.(false);
      return;
    }

    const usedRows = Math.max(1, Math.round(rows * Math.max(0.01, Math.min(1, spec.useTopRatio ?? 1))));

    // target counts from avg
    const float20 = interpolateConditionMix20(tRef.current);
    const targetCounts = scaleMixToCount(float20, POOL_SIZE);

    // minimally adjust pool conditions
    const pool = poolRef.current!;
    const currentKinds = pool.map(p => p.cond);
    const newKinds = adjustConditionsStable(currentKinds, targetCounts);
    for (let i = 0; i < pool.length; i++) pool[i].cond = newKinds[i] ?? pool[i].cond;

    // group by kind
    const byKind: Record<ConditionKind, PoolItem[]> = { A: [], B: [], C: [], D: [] };
    for (const it of pool) byKind[it.cond].push(it);

    const salt = (rows * 73856093) ^ (cols * 19349663);
    const nextPool: PoolItem[] = pool.map(p => ({ ...p, shape: undefined, size: undefined, footprint: undefined, x: undefined, y: undefined }));

    // deterministic planning instead of random/hashed 50-50
    (['A','B','C','D'] as ConditionKind[]).forEach((kind) => {
      const items = byKind[kind];
      if (!items.length) return;
      const u = tRef.current; // normalized liveAvg
      const map = planForBucket(kind, items, u /* ← required */, salt);
      for (const p of nextPool) {
        if (p.cond !== kind) continue;
        const asn = map.get(p.id);
        if (asn) { p.shape = asn.shape; p.size = asn.size; }
      }
    });

    // occupancy + placement
    const occ = createOccupancy(
      rows,
      cols,
      (r, c) => cellForbidden(r, c, rows, cols, spec)
    );

    const fallbackCells = buildCandidates(rows, cols, spec);

    const placed: Array<{ id:number; x:number; y:number; shape?: ShapeName; footprint: FootRect }> = [];
    let cursor = 0;

    for (let i = 0; i < nextPool.length; i++) {
      const item = nextPool[i];
      if (!item.size) continue;
      const { w: wCell, h: hCell } = item.size;

      let rectHit: FootRect | null = null;

      // GROUND shapes include: house, villa, power, car
      if (item.shape === 'house' || item.shape === 'villa' || item.shape === 'power' || item.shape === 'car') {
        const isHouse = item.shape === 'house';
        const lane = pickLane(isHouse ? 'house' : 'villa', item.id, salt);

        const { top: bandTop, bot: bandBot } =
          RowRules.preferredGroundBand(item.shape, usedRows, band, hCell);
        const rowOrder = rowOrderFromBand(bandTop, bandBot);

        const candidates: Array<{ r0:number; c0:number; score:number }> = [];
        // STRICT within-band scan
        for (const r0 of rowOrder) {
          if (r0 < bandTop || (r0 + hCell - 1) > bandBot) continue;
          const segs = allowedSegmentsForRow(r0, wCell, hCell, rows, cols, spec);
          for (const seg of segs) {
            const segCenterC = (seg.cStart + seg.cEnd + wCell) / 2;
            for (let c0 = seg.cStart; c0 <= seg.cEnd; c0++) {
              const score = scoreGroundCandidate(
                rows, cols, usedRows,
                r0, c0, wCell, hCell,
                lane, segCenterC,
                bandTop, bandBot,
                item.shape
              );
              candidates.push({ r0, c0, score });
            }
          }
        }

        // BAND-AWARE gentle fallback
        if (candidates.length === 0) {
          const pad = 2; // allow ±2 rows around band
          const fTop = Math.max(0, bandTop - pad);
          const fBot = Math.min(rows - hCell, bandBot + pad);

          for (let r0 = fTop; r0 <= fBot; r0++) {
            const segs = allowedSegmentsForRow(r0, wCell, hCell, rows, cols, spec);
            for (const seg of segs) {
              const segCenterC = (seg.cStart + seg.cEnd + wCell) / 2;
              for (let c0 = seg.cStart; c0 <= seg.cEnd; c0++) {
                const score = scoreGroundCandidate(
                  rows, cols, usedRows,
                  r0, c0, wCell, hCell,
                  lane, segCenterC,
                  bandTop, bandBot,
                  item.shape
                ) - 4;
                candidates.push({ r0, c0, score });
              }
            }
          }
        }

        candidates.sort((a, b) => b.score - a.score);
        for (const cand of candidates) {
          const hit = occ.tryPlaceAt(cand.r0, cand.c0, wCell, hCell);
          if (hit) { rectHit = hit; break; }
        }
      } else {
        // SKY placement (clouds, snow, sun) — device-aware band
        const { rMin, rMax } = RowRules.skyBand(item.shape, usedRows, band);

        const placedSky = placed
          .filter(p => isSky(p.shape))
          .map(p => ({ r0: p.footprint.r0, c0: p.footprint.c0, w: p.footprint.w, h: p.footprint.h }));

        const skyCandidates: Array<{ r0:number; c0:number; score:number }> = [];
        for (let r0 = rMin; r0 <= Math.min(rMax, rows - hCell); r0++) {
          const segs = allowedSegmentsForRow(r0, wCell, hCell, rows, cols, spec);
          for (const seg of segs) {
            for (let c0 = seg.cStart; c0 <= seg.cEnd; c0++) {
              const score = scoreSkyCandidate(
                r0, c0, wCell, hCell, rows, cols, usedRows, placedSky, salt
              );
              skyCandidates.push({ r0, c0, score });
            }
          }
        }

        if (skyCandidates.length === 0) {
          for (let k = cursor; k < fallbackCells.length; k++) {
            const { r, c } = fallbackCells[k];
            if (r < rMin || r > rMax) continue;
            if (!footprintAllowed(r, c, wCell, hCell, rows, cols, spec)) continue;
            const hit = occ.tryPlaceAt(r, c, wCell, hCell);
            if (hit) { rectHit = hit; cursor = Math.max(k - 2, 0); break; }
          }
        } else {
          skyCandidates.sort((a,b) => b.score - a.score);
          for (const cand of skyCandidates) {
            const hit = occ.tryPlaceAt(cand.r0, cand.c0, wCell, hCell);
            if (hit) { rectHit = hit; break; }
          }
        }
      }

      if (!rectHit) continue;

      const cr = rectHit.r0 + Math.floor(rectHit.h / 2);
      const cc = rectHit.c0 + Math.floor(rectHit.w / 2);
      let { x, y } = cellCenterToPx(cell, cr, cc);

      // sun wants strict top-left anchoring (to center of its rect)
      if (item.shape === 'sun') {
        x = (rectHit.c0 + rectHit.w / 2) * cell;
        y = (rectHit.r0 + rectHit.h / 2) * cell;
      }

      item.footprint = rectHit;
      item.x = x; item.y = y;

      placed.push({ id: item.id, x, y, shape: item.shape, footprint: rectHit });
    }

    poolRef.current = nextPool;

    const u = clamp01(liveAvg);
    ensureAtLeastOneSunAtLowAvg(placed, u, usedRows, band);

    engine.controls.current?.setFieldItems?.(placed);
    engine.controls.current?.setFieldVisible?.(true);
  }, [engine, liveAvg]);
}
