// src/canvas/layout/grid-layout/forbidden.ts

export type GridRectFrac = { top: number; left: number; bottom: number; right: number };

export type ForbiddenSpec = {
  forbiddenRects?: GridRectFrac[];
  forbidden?: (r: number, c: number, rows: number, cols: number) => boolean;
};

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
export function makeCellForbidden(spec: ForbiddenSpec, rows: number, cols: number) {
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

export type RowRule = {
  left?: number | `${number}%`;
  right?: number | `${number}%`;
  center?: number | `${number}%`;
};

function toCols(val: RowRule[keyof RowRule] | undefined, cols: number): number {
  if (val == null) return 0;

  if (typeof val === 'string' && val.endsWith('%')) {
    const p = Math.max(0, Math.min(100, parseFloat(val)));
    return Math.floor((p / 100) * cols);
  }

  if (typeof val === 'number') {
    if (val >= 1) return Math.floor(val);
    return Math.floor(Math.max(0, Math.min(1, val)) * cols);
  }

  return 0;
}

/**
 * Builds a per-cell forbidden predicate from row-oriented trimming rules.
 * Each row can specify left/right trims and an optional centered blocked span.
 */
export function makeRowForbidden(rules: RowRule[]) {
  return (r: number, c: number, _rows: number, cols: number) => {
    const rule = rules[Math.min(r, rules.length - 1)] || {};
    const leftCols = toCols(rule.left, cols);
    const rightCols = toCols(rule.right, cols);
    const centerCols = toCols(rule.center, cols);

    if (leftCols > 0 && c < leftCols) return true;
    if (rightCols > 0 && c >= cols - rightCols) return true;

    if (centerCols > 0) {
      const start = Math.max(0, Math.floor((cols - centerCols) / 2));
      const end = Math.min(cols - 1, start + centerCols - 1);
      if (c >= start && c <= end) return true;
    }

    return false;
  };
}
