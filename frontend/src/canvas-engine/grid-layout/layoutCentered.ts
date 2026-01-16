// src/canvas/layout/grid-layout/layoutCentered.ts

export type Pt = { x: number; y: number };

export type MakeCenteredGridOpts = {
  w: number;
  h: number;
  rows: number;
  useTopRatio?: number;
  cols: number;
};
// w: available horizontal space
// h: total vertical space
// rows: authoritative vertical density
// useTopRatio: vertical cropping (top portion only)

export function makeCenteredSquareGrid(opts: MakeCenteredGridOpts) {
  const { w, h, rows, useTopRatio = 1 } = opts;

  const usableH = Math.max(1, Math.round(h * Math.max(0.01, Math.min(1, useTopRatio))));

  // row
  const cellH = usableH / Math.max(1, rows);

  // controversial 
const cols = 18;              // try 12 / 24 / 40
const cellW = w / cols;

  // no need for ox centering because we fill width exactly
  const ox = 0;
  const oy = 0;

  const points: Pt[] = [];
  for (let r = 0; r < rows; r++) {
    const cy = oy + r * cellH + cellH / 2;
    for (let c = 0; c < cols; c++) {
      const cx = ox + c * cellW + cellW / 2;
      points.push({ x: Math.round(cx), y: Math.round(cy) });
    }
  }

  const cell = cellH; // legacy scalar used everywhere else
  return { points, rows, cols, cell, cellW, cellH, ox, oy };
}


/**
 * Converts avg in [0..1] to a row-major index into a flattened list of total length.
 */
export function indexFromAvg(avg: number, total: number) {
  const t = Number.isFinite(avg) ? Math.max(0, Math.min(1, avg)) : 0.5;
  return Math.min(total - 1, Math.max(0, Math.round(t * (total - 1))));
}

/**
 * Computes how many rows are considered within the “used” region.
 * This mirrors the way makeCenteredSquareGrid derives usable height.
 */
export function usedRowsFromSpec(rows: number, useTopRatio?: number) {
  const useTop = Math.max(0.01, Math.min(1, useTopRatio ?? 1));
  return Math.max(1, Math.round(rows * useTop));
}
