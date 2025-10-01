// src/canvas/grid/config.ts
export type BreakBand = 'small' | 'medium' | 'large';

export type GridSpec = {
  rows: number;          // number of square cells vertically (drives cell size)
  useTopRatio?: number;  // portion of height to use (e.g., 0.5 = top half)
  cap?: number;          // hard cap on number of points
  cellPadding?: number;  // 0..0.5 (margin inside each cell before jitter)
  jitter?: number;       // px jitter
};

export function bandFromWidth(w: number): BreakBand {
  if (w < 768) return 'small';
  if (w <= 1024) return 'medium';
  return 'large';
}

export const GRID_MAP: Record<BreakBand, GridSpec> = {
  // rows → cellSize = (useTopRatio * height) / rows, cols = ceil(width / cellSize)
  small:  { rows: 10, useTopRatio: 0.5, cap: 36,  cellPadding: 0.18, jitter: 6 },
  medium: { rows: 14, useTopRatio: 0.5, cap: 72,  cellPadding: 0.17, jitter: 8 },
  large:  { rows: 8, useTopRatio: 0.8, cap: 128, cellPadding: 0, jitter: 0 },
};
