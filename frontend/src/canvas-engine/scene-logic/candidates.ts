// src/canvas/scene-logic/candidates.ts

import type { CanvasPaddingSpec } from '../shared/scene-schema/canvasPadding.ts';

/**
 * Produces an ordered list of candidate (r,c) cells for fallback placement.
 * Non-overlay mode sorts by distance to the used-region center.
 */
export function buildFallbackCells(
  rows: number,
  cols: number,
  spec: CanvasPaddingSpec, 
  opts?: { overlay?: boolean }
) {
  const useTop = Math.max(0.01, Math.min(1, spec.useTopRatio ?? 1));
  const usedRows = Math.max(1, Math.round(rows * useTop));
  const centerR = (usedRows - 1) / 2;
  const centerC = (cols - 1) / 2;

  const out: Array<{ r: number; c: number; d2: number }> = [];

  for (let r = 0; r < rows; r++) {
    const rInUsed =
      r < usedRows ? r : (usedRows - 1) + (r - usedRows + 1) * 2;

    for (let c = 0; c < cols; c++) {
      const dr = rInUsed - centerR;
      const dc = c - centerC;
      out.push({ r, c, d2: dr * dr + dc * dc });
    }
  }

  if (!opts?.overlay) out.sort((a, b) => a.d2 - b.d2);

  return out.map(({ r, c }) => ({ r, c }));
}
