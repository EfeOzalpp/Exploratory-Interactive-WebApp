// src/canvas-engine/scene-logic/scoring.ts

import { rand01Keyed } from '../shared/utils/hash32.ts';
import type { ShapeName } from '../shared/scene-schema/shapeCatalog.ts';
import { groupOf, separationOf } from '../shared/scene-schema/shapeMeta.ts';

export type PlacedFoot = {
  r0: number; c0: number; w: number; h: number; shape?: ShapeName;
};

function centerOf(f: { r0: number; c0: number; w: number; h: number }) {
  return { x: f.c0 + f.w / 2, y: f.r0 + f.h / 2 };
}

export function scoreCandidateGeneric(opts: {
  r0: number;
  c0: number;
  wCell: number;
  hCell: number;
  cols: number;
  usedRows: number;
  placed: PlacedFoot[];
  salt: number;
  shape?: ShapeName;
  centerBias?: boolean;
}) {
  const { r0, c0, wCell, hCell, cols, usedRows, placed, salt, shape, centerBias = true } = opts;

  const { x: cx, y: cy } = centerOf({ r0, c0, w: wCell, h: hCell });

  // mild center preference
  const gridCx = (cols - 1) / 2;
  const usedCy = (usedRows - 1) / 2;
  const dCenter2 = (cx - gridCx) ** 2 + (cy - usedCy) ** 2;
  const centerTerm = centerBias ? -0.08 * dCenter2 : 0;

  // group separation (soft)
  let sepPenalty = 0;
  if (shape) {
    const sep = separationOf(shape);
    if (sep > 0) {
      const g = groupOf(shape);

      let minD = Infinity;
      for (const p of placed) {
        if (!p.shape) continue;
        if (groupOf(p.shape) !== g) continue;

        const pc = centerOf(p);
        const dx = cx - pc.x;
        const dy = cy - pc.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minD) minD = d;
      }

      if (minD !== Infinity && minD < sep) {
        const t = sep - minD;
        sepPenalty = -3.0 * t * t;
      }
    }
  }

  // deterministic jitter
  const jitter = (rand01Keyed(`cand|${r0},${c0},${wCell},${hCell}|${salt}`) - 0.5) * 0.25;

  return centerTerm + sepPenalty + jitter;
}
