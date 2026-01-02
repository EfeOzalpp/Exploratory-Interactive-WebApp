// src/canvas/grid/layoutCentered.ts
export type Pt = { x: number; y: number };

type MakeCenteredGridOpts = {
  w: number;
  h: number;
  rows: number;           // vertical cells (drives cell side)
  useTopRatio?: number;   // portion of height to use (e.g., 0.5 = top half)
};

export function makeCenteredSquareGrid(opts: MakeCenteredGridOpts) {
  const { w, h, rows, useTopRatio = 1 } = opts;

  const usableH = Math.max(1, Math.round(h * Math.max(0.01, Math.min(1, useTopRatio))));
  const cell = usableH / Math.max(1, rows);          // square side from height
  const cols = Math.ceil(w / cell);                  // width derives from square side

  const points: Pt[] = [];
  for (let r = 0; r < rows; r++) {
    const cy = r * cell + cell / 2;
    for (let c = 0; c < cols; c++) {
      const cx = c * cell + cell / 2;
      if (cx < 0 || cx > w) continue;               // ignore partial overflow at right
      points.push({ x: Math.round(cx), y: Math.round(cy) });
    }
  }
  return { points, rows, cols, cell };
}

/** Linear index (row-major) from avg ∈ [0..1] */
export function indexFromAvg(avg: number, total: number) {
  const t = Number.isFinite(avg) ? Math.max(0, Math.min(1, avg)) : 0.5;
  return Math.min(total - 1, Math.max(0, Math.round(t * (total - 1))));
}
