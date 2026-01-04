// src/canvas/layout/grid-layout/config.ts
export type BreakBand = 'small' | 'medium' | 'large';

export type GridRectFrac = { top: number; left: number; bottom: number; right: number };

export type GridSpec = {
  rows: number;

  /**
   * Portion of the grid height that is treated as the “used” region.
   * This is consumed by layout math and policy layers to bias placement into the top area.
   */
  useTopRatio?: number;

  /**
   * Optional soft cap used by callers to limit how many items they attempt to place.
   */
  cap?: number;

  /**
   * Optional padding in pixels that callers may use when converting cell rects to draw rects.
   */
  cellPadding?: number;

  /**
   * Optional pixel jitter that callers may apply to final point placement.
   */
  jitter?: number;

  /**
   * Rectangles expressed as fractions of the grid area. They are converted to cell ranges by helpers
   * and treated as forbidden.
   */
  forbiddenRects?: GridRectFrac[];

  /**
   * Custom forbidden predicate at cell granularity.
   * If provided, it is checked in addition to forbiddenRects.
   */
  forbidden?: (r: number, c: number, rows: number, cols: number) => boolean;
};

type RowRule = {
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

/**
 * Discrete band classification used by presets and policy.
 */
export function bandFromWidth(w: number): BreakBand {
  if (w <= 767) return 'small';
  if (w <= 1024) return 'medium';
  return 'large';
}

// Here are multiple row rules where we add forbidden spaces 
// to not overlap with other UI elements

export const GRID_MAP_START: Record<BreakBand, GridSpec> = {
  small: {
    rows: 18,
    useTopRatio: 0.9,
    cap: 28,
    cellPadding: 0,
    jitter: 6,
    forbidden: makeRowForbidden([
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { center: '100%' },
      { center: '100%' },
      { center: '100%' },
      { center: '100%' },
      { center: '100%' },
      { center: '100%' },
      { center: '100%' },
      { center: '100%' },
    ]),
  },

  medium: {
    rows: 17,
    useTopRatio: 0.8,
    cap: 56,
    cellPadding: 0,
    jitter: 8,
    forbidden: makeRowForbidden([
      { center: '100%' },
      { center: '100%' },
      { left: '2%', right: '2%' },
      { left: '2%', right: '2%' },
      { left: '2%', right: '2%' },
      { left: '2%', right: '2%' },
      { left: '2%', right: '2%' },
      { left: '2%', right: '2%' },
      { left: '2%', right: '2%' },
      { left: '2%', right: '2%' },
      { left: '2%', right: '2%' },
      { center: '100%' },
      { center: '100%' },
      { center: '100%' },
      { center: '100%' },
      { center: '100%' },
    ]),
  },

  large: {
    rows: 12,
    useTopRatio: 0.8,
    cap: 128,
    cellPadding: 0,
    jitter: 12,
    forbidden: makeRowForbidden([
      { center: '100%' },
      { left: '28%', right: '30%' },
      { left: '14%', right: '22%' },
      { left: '10%', right: '20%' },
      { left: '8%', right: '15%' },
      { left: '8%', right: '15%' },
      { left: '8%', right: '15%', center: '30%' },
      { left: '6%', right: '12%', center: '50%' },
      { center: '100%' },
      { center: '100%' },
      { center: '100%' },
      { center: '100%' },
      { center: '100%' },
    ]),
  },
};

export const GRID_MAP_QUESTIONNAIRE: Record<BreakBand, GridSpec> = {
  small: {
    rows: 24,
    useTopRatio: 1,
    cap: 28,
    cellPadding: 0,
    jitter: 6,
    forbidden: makeRowForbidden([
      { center: '100%' }, { center: '100%' }, { center: '100%' }, { center: '100%' },
      { center: '100%' }, { center: '100%' }, { center: '100%' }, { center: '100%' },
      { center: '100%' }, { center: '100%' }, { center: '100%' }, { center: '100%' },
      { center: '100%' },
      { left: '0%', right: '0%', center: '50%' },
      { left: '0%', right: '0%', center: '50%' },
      { left: '0%', right: '0%', center: '50%' },
      { left: '0%', right: '0%', center: '60%' },
      { left: '0%', right: '0%', center: '60%' },
      { left: '0%', right: '0%', center: '50%' },
      { left: '0%', right: '0%', center: '50%' },
      { left: '0%', right: '0%', center: '50%' },
      { left: '0%', right: '0%', center: '50%' },
      { left: '0%', right: '0%', center: '50%' },
    ]),
  },

  medium: {
    rows: 22,
    useTopRatio: 1,
    cap: 56,
    cellPadding: 0,
    jitter: 2,
    forbidden: makeRowForbidden([
      { center: '100%' }, { center: '100%' }, { center: '100%' }, { center: '100%' },
      { center: '100%' }, { center: '100%' }, { center: '100%' }, { center: '100%' },
      { center: '100%' }, { center: '100%' }, { center: '100%' },
      { left: '0%', right: '0%', center: '50%' },
      { left: '0%', right: '0%', center: '56%' },
      { left: '0%', right: '0%', center: '56%' },
      { left: '0%', right: '0%', center: '66%' },
      { left: '0%', right: '0%', center: '66%' },
      { left: '0%', right: '0%', center: '40%' },
      { left: '0%', right: '0%', center: '40%' },
      { left: '0%', right: '0%', center: '40%' },
      { left: '0%', right: '0%', center: '40%' },
    ]),
  },

  large: {
    rows: 16,
    useTopRatio: 0.85,
    cap: 128,
    cellPadding: 0,
    jitter: 12,
    forbidden: makeRowForbidden([
      { center: '100%' },
      { left: '28%', right: '30%' },
      { left: '28%', right: '30%' },
      { left: '5%', right: '5%' },
      { left: '5%', right: '5%' },
      { left: '5%', right: '5%' },
      { left: '5%', right: '5%', center: '40%' },
      { left: '5%', right: '5%', center: '50%' },
      { left: '5%', right: '5%', center: '60%' },
      { left: '5%', right: '5%', center: '65%' },
      { left: '5%', right: '5%', center: '65%' },
      { left: '5%', right: '5%', center: '65%' },
      { center: '100%' },
      { center: '100%' },
    ]),
  },
};

export const GRID_MAP_OVERLAY: Record<BreakBand, GridSpec> = {
  small: {
    rows: 24,
    useTopRatio: 1,
    cap: 2,
    cellPadding: 0,
    jitter: 6,
    forbidden: makeRowForbidden([
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
    ]),
  },

  medium: {
    rows: 22,
    useTopRatio: 1,
    cap: 40,
    cellPadding: 0,
    jitter: 2,
    forbidden: makeRowForbidden([
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
    ]),
  },

  large: {
    rows: 18,
    useTopRatio: 1,
    cap: 4,
    cellPadding: 0,
    jitter: 12,
    forbidden: makeRowForbidden([
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
      { left: '0%', right: '0%' },
    ]),
  },
};

/**
 * Selects a grid spec based on width and mode.
 * Scene-level layout can use the resulting spec to compute forbidden cells, usedRows, and placement bias.
 */
export function getGridSpec(
  width: number,
  questionnaireOpen: boolean,
  opts?: { overlay?: boolean }
): GridSpec {
  const band = bandFromWidth(width);
  if (opts?.overlay) return GRID_MAP_OVERLAY[band];
  const map = questionnaireOpen ? GRID_MAP_QUESTIONNAIRE : GRID_MAP_START;
  return map[band];
}
