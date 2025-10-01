export type Pt = { x: number; y: number };

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function rnd() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type MakeSquareGridOpts = {
  w: number; h: number; rows: number;
  useTopRatio?: number; cap?: number; cellPadding?: number; jitter?: number; seed?: number;
};

export function makeSquareGrid(opts: MakeSquareGridOpts): Pt[] {
  const { w, h, rows, useTopRatio = 1, cap, cellPadding = 0.15, jitter = 6, seed = 1337 } = opts;
  const rnd = mulberry32(seed);

  const usableH = Math.max(1, Math.round(h * Math.max(0.01, Math.min(1, useTopRatio))));
  const cell = usableH / Math.max(1, rows);          // SQUARE SIDE (height-driven)
  const cols = Math.ceil(w / cell);                   // width may not align perfectly
  const pad = Math.min(0.49, Math.max(0, cellPadding)) * cell;

  const pts: Pt[] = [];
  outer: for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cap && pts.length >= cap) break outer;
      const cx = c * cell + cell / 2;
      const cy = r * cell + cell / 2;
      if (cx < 0 || cx > w) continue;                // ignore overflow at right edge
      const rx = (rnd() * 2 - 1) * (cell / 2 - pad);
      const ry = (rnd() * 2 - 1) * (cell / 2 - pad);
      const jx = (rnd() * 2 - 1) * jitter;
      const jy = (rnd() * 2 - 1) * jitter;
      pts.push({ x: Math.round(cx + rx + jx), y: Math.round(cy + ry + jy) });
    }
  }
  return pts;
}
