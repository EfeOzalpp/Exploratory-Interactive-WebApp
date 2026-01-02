// src/canvas/hooks/useGridDotField.ts
import { useEffect, useRef } from 'react';
import { bandFromWidth, getGridSpec, type GridSpec } from '../grid-layout/config.ts';
import { useAppState } from '../../app-context/appStateContext.tsx';
import { makeCenteredSquareGrid } from '../grid-layout/layoutCentered.ts';
import { createOccupancy } from '../grid-layout/occupancy.ts';
import { cellCenterToPx } from '../grid-layout/coords.ts';

import type { ConditionKind } from '../condition-utils/conditionAllocation.ts';
import {
  interpolateConditionMix20,
  scaleMixToCount,
  adjustConditionsStable,
} from '../condition-utils/conditionAllocation.ts';

import { RowRules } from '../grid-layout/rowRules.ts';

import {
  planForBucket,
  type PoolItem as PlannerPoolItem,
  type ShapeName,
  type Size,
} from '../condition-utils/conditionPlanner.ts';

type FootRect = { r0: number; c0: number; w: number; h: number };

type PoolItem = PlannerPoolItem & {
  shape?: ShapeName;
  size?: Size;
  footprint?: FootRect;
  x?: number;
  y?: number;
};

type Engine = { ready: React.MutableRefObject<boolean>; controls: React.MutableRefObject<any> };

// ───────────────────────────────────────────────────────────────────────────────
// Responsive pool sizes (start/default vs questionnaire/open vs overlay)
// Adjust these to your taste. Overlay uses its own set.
// ───────────────────────────────────────────────────────────────────────────────
const START_POOL_SIZE_SM = 18;
const START_POOL_SIZE_MD = 26;
const START_POOL_SIZE_LG = 28;

const QUESTION_POOL_SIZE_SM = 24;
const QUESTION_POOL_SIZE_MD = 32;
const QUESTION_POOL_SIZE_LG = 28;

// Overlay targeted counts (example values)
const OVERLAY_POOL_SIZE_SM = 60;
const OVERLAY_POOL_SIZE_MD = 80;
const OVERLAY_POOL_SIZE_LG = 100;

// Helper to classify width into sm/md/lg
function widthBucket(width?: number): 'sm' | 'md' | 'lg' {
  if (width == null) return 'lg';
  if (width <= 768) return 'sm';
  if (width <= 1024) return 'md';
  return 'lg';
}

// Single truth for target pool size
function targetPoolSize(opts: { isQuestionnaireOpen: boolean; isOverlay: boolean; width?: number }) {
  const bucket = widthBucket(opts.width);
  if (opts.isOverlay) {
    return bucket === 'sm' ? OVERLAY_POOL_SIZE_SM
         : bucket === 'md' ? OVERLAY_POOL_SIZE_MD
         : OVERLAY_POOL_SIZE_LG;
  }
  if (opts.isQuestionnaireOpen) {
    return bucket === 'sm' ? QUESTION_POOL_SIZE_SM
         : bucket === 'md' ? QUESTION_POOL_SIZE_MD
         : QUESTION_POOL_SIZE_LG;
  }
  return bucket === 'sm' ? START_POOL_SIZE_SM
       : bucket === 'md' ? START_POOL_SIZE_MD
       : START_POOL_SIZE_LG;
}

const clamp01 = (v?: number) => (typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5);

// IMPORTANT: always derive logical size from the canvas backing store.
// This avoids rect-based reads that can be mid-animation or subpixel.
function getCanvasLogicalSize(canvas: HTMLCanvasElement | undefined | null) {
  if (!canvas) {
    const w = (typeof window !== 'undefined') ? window.innerWidth : 1024;
    const h = (typeof window !== 'undefined') ? window.innerHeight : 768;
    return { w: Math.round(w), h: Math.round(h) };
  }
  const dpr = (canvas as any)._dpr || (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const w = (canvas.width || 0) / dpr;
  const h = (canvas.height || 0) / dpr;
  // Fallback to cssW/cssH if present (engine sets these)
  const cssW = (canvas as any)._cssW;
  const cssH = (canvas as any)._cssH;
  const W = Number.isFinite(cssW) ? cssW : w;
  const H = Number.isFinite(cssH) ? cssH : h;
  return { w: Math.round(W), h: Math.round(H) };
}

function buildCandidates(rows: number, cols: number, spec: GridSpec, opts?: { overlay?: boolean }) {
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
  if (!opts?.overlay) {
    out.sort((a, b) => a.d2 - b.d2);
  }
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

function isSky(shape?: ShapeName) {
  return shape === 'clouds' || shape === 'snow' || shape === 'sun';
}

function rand01Keyed(key:string) {
  const h = hash32(key);
  return ((h >>> 8) & 0xffff) / 0xffff;
}

function scoreSkyCandidate(
  r0:number, c0:number, wCell:number, hCell:number,
  rows:number, cols:number, usedRows:number,
  placedSky: Array<{r0:number; c0:number; w:number; h:number}>,
  salt:number,
  centerBias = true
){
  const cx = c0 + wCell / 2;
  const cy = r0 + hCell / 2;
  const gridCx = (cols - 1) / 2;
  const usedCy = (usedRows - 1) / 2;

  const dCenter2 = (cx - gridCx) ** 2 + (cy - usedCy) ** 2;
  const centerPenalty = centerBias ? (-0.12 * dCenter2) : 0;

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

function scoreGroundCandidate(
  _rows: number, cols: number, usedRows: number,
  r0: number, c0: number, wCell: number, hCell: number,
  lane: number | null,
  segCenterC: number,
  bandTop: number,
  bandBot: number,
  shape?: ShapeName,
  opts?: { centerBias?: boolean; segPull?: boolean }
) {
  if (r0 < bandTop || (r0 + hCell - 1) > bandBot) return -1e9;

  const colCenter = c0 + wCell / 2;
  const rowCenter = r0 + hCell / 2;
  const gridColCenter = (cols - 1) / 2;
  const usedRowCenter = (usedRows - 1) / 2;

  const dCol2 = (colCenter - gridColCenter) ** 2;
  const dRow2 = (rowCenter - usedRowCenter) ** 2;

  const centerBias = opts?.centerBias ?? true;
  const segPullOn  = opts?.segPull ?? true;
  
  const wCol = centerBias ? 1.0 : 0;
  const wRow = centerBias ? 0.6 : 0;

  const edgeLeft  = Math.max(0, 2 - c0);
  const edgeRight = Math.max(0, (c0 + wCell) - (cols - 2));
  const edgePenalty = (edgeLeft + edgeRight) * 6;
  
  const lanePenalty = (lane != null && (c0 % 3) !== lane) ? 2 : 0;
  const segPull = segPullOn ? (-0.9 * (colCenter - segCenterC) ** 2) : 0;

  const jitter = (hash32(`g|${r0},${c0},${wCell},${hCell}`) & 0xff) / 255 * 0.2;

  let carBias = 0;
  if (shape === 'car') {
    const bandBotCenter = bandBot + 0.5;
    const dist = (rowCenter - bandBotCenter);
    carBias = -0.25 * (dist * dist);
  }

  return -(wCol * dCol2 + wRow * dRow2) - lanePenalty - edgePenalty + segPull + jitter + carBias;
}

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

export function useGridDotField(
  engine: Engine,
  allocAvg: number | undefined,
  viewportKey?: number | string,
  // tell the hook whether this is the overlay instance
  opts?: { overlay?: boolean }
) {
  const { questionnaireOpen } = useAppState();
  const isOverlay = !!opts?.overlay;

  const tRef = useRef(clamp01(allocAvg));
  tRef.current = clamp01(allocAvg);

  const poolRef = useRef<PoolItem[] | null>(null);
  const ensurePoolSize = (desired: number) => {
    if (!poolRef.current) {
      poolRef.current = Array.from({ length: desired }, (_, i) => ({
        id: i + 1,
        cond: 'A' as ConditionKind,
      }));
      return;
    }
    const cur = poolRef.current!;
    if (cur.length === desired) return;

    if (cur.length > desired) {
      poolRef.current = cur.slice(0, desired);
    } else {
      const maxId = cur.reduce((m, p) => Math.max(m, p.id), 0);
      const toAdd = desired - cur.length;
      const extra = Array.from({ length: toAdd }, (_, k) => ({
        id: maxId + k + 1,
        cond: 'A' as ConditionKind,
      }));
      poolRef.current = cur.concat(extra);
    }
  };

  // Initial guess (will be corrected once engine is ready)
  const initialW =
    (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : undefined;
  ensurePoolSize(targetPoolSize({
    isQuestionnaireOpen: questionnaireOpen,
    isOverlay,
    width: initialW
  }));

  useEffect(() => {
    if (!engine?.ready?.current) return;

    engine.controls.current?.setQuestionnaireOpen?.(questionnaireOpen);

    // 🔒 SINGLE SOURCE OF TRUTH: logical canvas size (not rect)
    const canvas = engine.controls.current?.canvas as HTMLCanvasElement | null | undefined;
    const { w, h } = getCanvasLogicalSize(canvas);

    // Ensure pool matches responsive size for the *actual* logical size
    ensurePoolSize(targetPoolSize({
      isQuestionnaireOpen: questionnaireOpen,
      isOverlay,
      width: w
    }));

    const band = bandFromWidth(w);
    const spec = getGridSpec(w, questionnaireOpen, { overlay: isOverlay });

    const { cell, rows, cols } = makeCenteredSquareGrid({
      w, h, rows: spec.rows, useTopRatio: spec.useTopRatio ?? 1,
    });
    if (!rows || !cols || !cell) {
      engine.controls.current?.setFieldVisible?.(false);
      return;
    }

    const usedRows = Math.max(1, Math.round(rows * Math.max(0.01, Math.min(1, spec.useTopRatio ?? 1))));

    const float20 = interpolateConditionMix20(tRef.current);
    const desiredSize = targetPoolSize({ isQuestionnaireOpen: questionnaireOpen, isOverlay, width: w });
    const targetCounts = scaleMixToCount(float20, desiredSize);

    const pool = poolRef.current!;
    const currentKinds = pool.map(p => p.cond);
    const newKinds = adjustConditionsStable(currentKinds, targetCounts);
    for (let i = 0; i < pool.length; i++) pool[i].cond = newKinds[i] ?? pool[i].cond;

    const byKind: Record<ConditionKind, PoolItem[]> = { A: [], B: [], C: [], D: [] };
    for (const it of pool) byKind[it.cond].push(it);

    const salt = (rows * 73856093) ^ (cols * 19349663);
    const nextPool: PoolItem[] = pool.map(p => ({ ...p, shape: undefined, size: undefined, footprint: undefined, x: undefined, y: undefined }));

    (['A','B','C','D'] as ConditionKind[]).forEach((kind) => {
      const items = byKind[kind];
      if (!items.length) return;
      const u = tRef.current;
      const map = planForBucket(kind, items, u, salt, isOverlay ? 'overlay' : 'default');
      for (const p of nextPool) {
        if (p.cond !== kind) continue;
        const asn = map.get(p.id);
        if (asn) { p.shape = asn.shape; p.size = asn.size; }
      }
    });

    const occ = createOccupancy(
      rows,
      cols,
      (r, c) => cellForbidden(r, c, rows, cols, spec)
    );

    const fallbackCells = buildCandidates(rows, cols, spec, { overlay: isOverlay });

    const placed: Array<{ id:number; x:number; y:number; shape?: ShapeName; footprint: FootRect }> = [];
    let cursor = 0;

    for (let i = 0; i < nextPool.length; i++) {
      const item = nextPool[i];
      if (!item.size) continue;
      const { w: wCell, h: hCell } = item.size;

      let rectHit: FootRect | null = null;

      if (item.shape === 'house' || item.shape === 'villa' || item.shape === 'power' || item.shape === 'car') {
        const isHouse = item.shape === 'house';
        const lane = pickLane(isHouse ? 'house' : 'villa', item.id, salt);

        const { top: bandTop, bot: bandBot } =
          RowRules.preferredGroundBand(item.shape, usedRows, band, hCell, {
            questionnaire: questionnaireOpen,
            overlay: isOverlay,
          });
        const rowOrder = rowOrderFromBand(bandTop, bandBot);

        const candidates: Array<{ r0:number; c0:number; score:number }> = [];
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
                item.shape,
                { centerBias: !isOverlay, segPull: !isOverlay }
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
            const segs = allowedSegmentsForRow(r0, wCell, hCell, rows, cols, spec);
            for (const seg of segs) {
              const segCenterC = (seg.cStart + seg.cEnd + wCell) / 2;
              for (let c0 = seg.cStart; c0 <= seg.cEnd; c0++) {
              const score = scoreGroundCandidate(
                rows, cols, usedRows,
                r0, c0, wCell, hCell,
                lane, segCenterC,
                bandTop, bandBot,
                item.shape,
                { centerBias: !isOverlay, segPull: !isOverlay }
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
        const { rMin, rMax } = RowRules.skyBand(item.shape, usedRows, band, {
          questionnaire: questionnaireOpen,
           overlay: isOverlay,
        });
        const placedSky = placed
          .filter(p => isSky(p.shape))
          .map(p => ({ r0: p.footprint.r0, c0: p.footprint.c0, w: p.footprint.w, h: p.footprint.h }));

        const skyCandidates: Array<{ r0:number; c0:number; score:number }> = [];
        for (let r0 = rMin; r0 <= Math.min(rMax, rows - hCell); r0++) {
          const segs = allowedSegmentsForRow(r0, wCell, hCell, rows, cols, spec);
          for (const seg of segs) {
            for (let c0 = seg.cStart; c0 <= seg.cEnd; c0++) {
            const score = scoreSkyCandidate(
              r0, c0, wCell, hCell, rows, cols, usedRows, placedSky, salt,
              /*centerBias*/ !isOverlay
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

      if (item.shape === 'sun') {
        x = (rectHit.c0 + rectHit.w / 2) * cell;
        y = (rectHit.r0 + rectHit.h / 2) * cell;
      }

      item.footprint = rectHit;
      item.x = x; item.y = y;

      placed.push({ id: item.id, x, y, shape: item.shape, footprint: rectHit });
    }

    poolRef.current = nextPool;

    const u = clamp01(allocAvg);
    ensureAtLeastOneSunAtLowAvg(placed, u, usedRows, band);

    engine.controls.current?.setFieldItems?.(placed);
    engine.controls.current?.setFieldVisible?.(true);
  }, [engine, allocAvg, questionnaireOpen, viewportKey, isOverlay]);
}
