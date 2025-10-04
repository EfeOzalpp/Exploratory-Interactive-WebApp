// src/canvas/grid/config.ts
export type BreakBand = 'small' | 'medium' | 'large';

export type GridSpec = {
  rows: number;
  useTopRatio?: number;
  cap?: number;
  cellPadding?: number;
  jitter?: number;
  // Optional mask:
  forbiddenRects?: Array<{ top: number; left: number; bottom: number; right: number }>;
  forbidden?: (r: number, c: number, rows: number, cols: number) => boolean;
};

/* ------------------ Row-sculpting helper ------------------ */

type RowRule = {
  /** forbid this many columns on the left (number = cols, '20%' = fraction) */
  left?: number | `${number}%`;
  /** forbid this many columns on the right (number = cols, '20%' = fraction) */
  right?: number | `${number}%`;
  /** forbid this many columns centered (number = cols, '20%' = fraction) */
  center?: number | `${number}%`;
};

function toCols(val: RowRule[keyof RowRule] | undefined, cols: number): number {
  if (val == null) return 0;
  if (typeof val === 'string' && val.endsWith('%')) {
    const p = Math.max(0, Math.min(100, parseFloat(val)));
    return Math.floor((p / 100) * cols);
  }
  // number: >=1 → absolute columns, 0..1 → fraction
  if (typeof val === 'number') {
    if (val >= 1) return Math.floor(val);
    return Math.floor(Math.max(0, Math.min(1, val)) * cols);
  }
  return 0;
}

export function makeRowForbidden(rules: RowRule[]) {
  return (r: number, c: number, _rows: number, cols: number) => {
    const rule = rules[Math.min(r, rules.length - 1)] || {};
    const leftCols   = toCols(rule.left, cols);
    const rightCols  = toCols(rule.right, cols);
    const centerCols = toCols(rule.center, cols);

    // left / right gutters
    if (leftCols > 0 && c < leftCols) return true;
    if (rightCols > 0 && c >= cols - rightCols) return true;

    // centered keep-out
    if (centerCols > 0) {
      const start = Math.max(0, Math.floor((cols - centerCols) / 2));
      const end   = Math.min(cols - 1, start + centerCols - 1);
      if (c >= start && c <= end) return true;
    }
    return false;
  };
}

/* ------------------ Your sculpted map ------------------ */

export function bandFromWidth(w: number): BreakBand {
  if (w < 768) return 'small';
  if (w <= 1024) return 'medium';
  return 'large';
}

export const GRID_MAP: Record<BreakBand, GridSpec> = {
  // Phones
  small:  {
    rows: 18,               // fewer rows => taller cells (better tap targets)
    useTopRatio: 0.8,     // use less sky; keep UI header clear
    cap: 28,
    cellPadding: 0.20,
    jitter: 6,
    forbidden: makeRowForbidden([
      { center: '100%' },     // r=0:
      { center: '100%' },     // r=1:       
      { left: '2%', right: '2%' },   // r=2 
      { left: '2%', right: '2%' },   // r=3 
      { left: '2%', right: '2%' },   // r=4
      { left: '2%', right: '2%' },   // r=5:
      { left: '2%', right: '2%' },   // r=2 
      { left: '2%', right: '2%' },   // r=3 
      { left: '2%', right: '2%' },   // r=4
      { left: '2%', right: '2%' },   // r=5:
      { center: '100%' },                  // r=6: big center keep-out (question text)
      { center: '100%' },                  // r=7: even bigger (slider zone)
      { center: '100%' },                 // r=7: fully block (buttons row)
      { center: '100%' },                 // r=8: bottom safe area
      { center: '100%' },                  // r=6: big center keep-out (question text)
      { center: '100%' },                  // r=7: even bigger (slider zone)
      { center: '100%' },                 // r=7: fully block (buttons row)
      { center: '100%' },                 // r=8: bottom safe area
    ]),
  },

  // Tablets / small laptops
  medium: {
    rows: 12,
    useTopRatio: 0.6,
    cap: 56,
    cellPadding: 0.18,
    jitter: 8,
    forbidden: makeRowForbidden([
      { center: '100%' },                // r=0
      { left: '16%', right: '18%' },     // r=1
      { left: '14%', right: '16%' },     // r=2
      { left: '12%', right: '14%' },     // r=3
      { left: '10%', right: '12%' },     // r=4
      { center: '40%' },                  // r=5: headline area
      { center: '55%' },                  // r=6: slider area
      { center: '80%' },                  // r=7: CTA zone
      {}, {}, {},                         // r=8..10: open for art
      { center: '100%' },                 // r=11: bottom gutter
    ]),
  },

  // Desktops
  large:  {
    rows: 12, useTopRatio: 0.8, cap: 128, cellPadding: 0, jitter: 12,
    forbidden: makeRowForbidden([
      { center: '100%' },            // r=0
      { left: '28%', right: '30%' }, // r=1
      { left: '22%', right: '22%' }, // r=2
      { left: '18%', right: '20%' }, // r=3
      { left: '13%', right: '15%' }, // r=4
      { left: '13%', right: '15%', center: '10%' }, // r=5
      { left: '13%', right: '15%', center: '30%' }, // r=6
      { left: '11%', right: '12%', center: '50%' }, // r=7
      { center: '100%' }, // r=8
      { center: '100%' }, // r=9
      { center: '100%' }, // r=10
      { center: '100%' }, // r=11
      { center: '100%' }, // (extra rule safety)
    ]),
  },
};

