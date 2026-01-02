// src/canvas/grid/config.ts
export type BreakBand = 'small' | 'medium' | 'large';

export type GridSpec = {
  rows: number;
  useTopRatio?: number;
  cap?: number;
  cellPadding?: number;
  jitter?: number;
  forbiddenRects?: Array<{ top: number; left: number; bottom: number; right: number }>;
  forbidden?: (r: number, c: number, rows: number, cols: number) => boolean;
};

/* ------------------ Row-sculpting helper ------------------ */

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

export function makeRowForbidden(rules: RowRule[]) {
  return (r: number, c: number, _rows: number, cols: number) => {
    const rule = rules[Math.min(r, rules.length - 1)] || {};
    const leftCols   = toCols(rule.left, cols);
    const rightCols  = toCols(rule.right, cols);
    const centerCols = toCols(rule.center, cols);

    if (leftCols > 0 && c < leftCols) return true;
    if (rightCols > 0 && c >= cols - rightCols) return true;

    if (centerCols > 0) {
      const start = Math.max(0, Math.floor((cols - centerCols) / 2));
      const end   = Math.min(cols - 1, start + centerCols - 1);
      if (c >= start && c <= end) return true;
    }
    return false;
  };
}

/* ------------------ Breakpoints ------------------ */

export function bandFromWidth(w: number): BreakBand {
  if (w <= 767) return 'small';
  if (w <= 1024) return 'medium';
  return 'large';
}

/* ------------------ GRID MAP A: start/default ------------------ */

export const GRID_MAP_START: Record<BreakBand, GridSpec> = {
  small: {
    rows: 18,
    useTopRatio: 0.9,
    cap: 28,
    cellPadding: 0,
    jitter: 6,
    forbidden: makeRowForbidden([
      { left: '0%', right: '0%' }, // r=0
      { left: '0%', right: '0%' }, // r=1
      { left: '0%', right: '0%' }, // r=2
      { left: '0%', right: '0%' }, // r=3
      { left: '0%', right: '0%' }, // r=4
      { left: '0%', right: '0%' }, // r=5
      { left: '0%', right: '0%' }, // r=6
      { left: '0%', right: '0%' }, // r=7
      { center: '100%' },          // r=8
      { center: '100%' },          // r=9
      { center: '100%' },          // r=10
      { center: '100%' },          // r=11
      { center: '100%' },          // r=12
      { center: '100%' },          // r=13
      { center: '100%' },          // r=14
      { center: '100%' },          // r=15
    ]),
  },

  medium: {
    rows: 17,
    useTopRatio: 0.8,
    cap: 56,
    cellPadding: 0,
    jitter: 8,
    forbidden: makeRowForbidden([
      { center: '100%' },            // r=0
      { center: '100%' },            // r=1
      { left: '2%', right: '2%' },  // r=2..10
      { left: '2%', right: '2%' },
      { left: '2%', right: '2%' },
      { left: '2%', right: '2%' },
      { left: '2%', right: '2%' },
      { left: '2%', right: '2%' },
      { left: '2%', right: '2%' },
      { left: '2%', right: '2%' },
      { left: '2%', right: '2%' },
      { center: '100%' },            // r=11..15
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
      { center: '100%' },                 // r=0
      { left: '28%', right: '30%' },      // r=1
      { left: '14%', right: '22%' },      // r=2
      { left: '10%', right: '20%' },      // r=3
      { left: '8%',  right: '15%' },      // r=4..5
      { left: '8%',  right: '15%' },
      { left: '8%',  right: '15%', center: '30%' }, // r=6
      { left: '6%',  right: '12%', center: '50%' }, // r=7
      { center: '100%' },                 // r=8..11
      { center: '100%' },
      { center: '100%' },
      { center: '100%' },
      { center: '100%' },                 // safety
    ]),
  },
};

/* ------------------ GRID MAP B: questionnaire-open ------------------ */

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
      { left: '5%',  right: '5%' },
      { left: '5%',  right: '5%' },
      { left: '5%',  right: '5%' },
      { left: '5%',  right: '5%', center: '40%' },
      { left: '5%',  right: '5%', center: '50%' },
      { left: '5%',  right: '5%', center: '60%' },
      { left: '5%',  right: '5%', center: '65%' },
      { left: '5%',  right: '5%', center: '65%' },
      { left: '5%',  right: '5%', center: '65%' },
      { center: '100%' },
      { center: '100%' },
    ]),
  },
};

/* ------------------ GRID MAP C: overlay (distinct layout, same math) ------------------ */

export const GRID_MAP_OVERLAY: Record<BreakBand, GridSpec> = {
  small: {
    rows: 24,
    useTopRatio: 1,
    cap: 2,
    cellPadding: 0,
    jitter: 6,
    // keep edges a touch wider; open center sooner
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
    // more breathing room left/right than questionnaire, but not as strict as start
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
    // keep the L/R trims, but slightly narrower center block vs start
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

/* ------------------ Selector ------------------ */

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
