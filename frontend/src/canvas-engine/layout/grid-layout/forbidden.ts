// src/canvas/layout/grid-layout/forbidden.ts
import type { GridRectFrac, GridSpec } from './config.ts';

export type CellRC = { r: number; c: number };

export function rectFracToCellRange(
  rect: GridRectFrac,
  rows: number,
  cols: number
): { r0: number; r1: number; c0: number; c1: number } {
  const r0 = Math.floor(rect.top * rows);
  const r1 = Math.ceil(rect.bottom * rows) - 1;
  const c0 = Math.floor(rect.left * cols);
  const c1 = Math.ceil(rect.right * cols) - 1;
  return { r0, r1, c0, c1 };
}

export function cellInRectFrac(
  r: number,
  c: number,
  rows: number,
  cols: number,
  rect: GridRectFrac
) {
  const { r0, r1, c0, c1 } = rectFracToCellRange(rect, rows, cols);
  return r >= r0 && r <= r1 && c >= c0 && c <= c1;
}

/**
 * Combines forbiddenRects and an optional per-cell forbidden predicate into a single checker.
 */
export function makeCellForbidden(spec: GridSpec, rows: number, cols: number) {
  const rects = spec.forbiddenRects ?? [];
  const fn = spec.forbidden;

  return (r: number, c: number) => {
    for (const rect of rects) {
      if (cellInRectFrac(r, c, rows, cols, rect)) return true;
    }
    if (fn && fn(r, c, rows, cols)) return true;
    return false;
  };
}
