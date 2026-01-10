// src/canvas/layout/grid-layout/layoutCentered.ts

export type Pt = { x: number; y: number };

export type MakeCenteredGridOpts = {
  w: number;
  h: number;
  rows: number;
  useTopRatio?: number;
};

/**
 * Constructs a square-cell grid where the cell size is driven by the (used) height.
 * The grid is generated in pixel space by returning the center point of each cell.
 */
export function makeCenteredSquareGrid(opts: MakeCenteredGridOpts) {
  const { w, h, rows, useTopRatio = 1 } = opts;

  const usableH = Math.max(
    1,
    Math.round(h * Math.max(0.01, Math.min(1, useTopRatio)))
  );

  const cell = usableH / Math.max(1, rows);
  const cols = Math.ceil(w / cell);

  const points: Pt[] = [];
  for (let r = 0; r < rows; r++) {
    const cy = r * cell + cell / 2;
    for (let c = 0; c < cols; c++) {
      const cx = c * cell + cell / 2;
      if (cx < 0 || cx > w) continue;
      points.push({ x: Math.round(cx), y: Math.round(cy) });
    }
  }

  return { points, rows, cols, cell };
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
