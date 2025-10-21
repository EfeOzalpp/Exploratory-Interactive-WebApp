// src/components/dotGraph/canvas/initShapeField.ts
import type { Q5 } from '../../../canvas/q5-lite'; // q5-lite exports the p-type
// Import your shape drawers (already aggregated in canvas/shape/index.js)
import {
  drawClouds, drawSnow, drawHouse, drawPower, drawVilla,
  drawCar, drawSea, drawSun, drawCarFactory, drawBus, drawTrees,
  getBaseRGB,
} from '../../../canvas/shape/index.js';

export type ShapeFieldParams = {
  // world → texture density knobs
  cols?: number;              // optional override; else derived from 12 rows
  rows?: number;              // defaults to 12 rows (square tiles)
  // weights drive how many of each we try to place (0..1)
  weights?: Partial<Record<
    'clouds'|'snow'|'sun'|'house'|'villa'|'power'|'car'|'sea'|'carFactory'|'bus'|'trees',
    number
  >>;
  // liveAvg can lerp color/alpha; allocAvg can change counts
  liveAvg?: number;           // 0..1 (visual lerps)
  allocAvg?: number;          // 0..1 (how many tiles we try to use)
  // optional deterministic seed
  seed?: number;
};

type DrawShapeFn = (p: any, x: number, y: number, size: number, opts?: any) => void;

// Minimal registry matching your shape API: (p, x, y, tile, opts)
const SHAPES: Record<string, DrawShapeFn> = {
  clouds:     (p, x, y, s, o) => drawClouds(p, x, y, s, o),
  snow:       (p, x, y, s, o) => drawSnow(p, x, y, s, o),
  sun:        (p, x, y, s, o) => drawSun(p, x, y, s, o),
  house:      (p, x, y, s, o) => drawHouse(p, x, y, s, o),
  villa:      (p, x, y, s, o) => drawVilla(p, x, y, s, o),
  power:      (p, x, y, s, o) => drawPower(p, x, y, s, o),
  car:        (p, x, y, s, o) => drawCar(p, x, y, s, o),
  sea:        (p, x, y, s, o) => drawSea(p, x, y, s, o),
  carFactory: (p, x, y, s, o) => drawCarFactory(p, x, y, s, o),
  bus:        (p, x, y, s, o) => drawBus(p, x, y, s, o),
  trees:      (p, x, y, s, o) => drawTrees(p, x, y, s, o),
};

// tiny deterministic PRNG
function makeRng(seed = 1337) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(v: number | undefined, d = 0) {
  if (typeof v !== 'number' || Number.isNaN(v)) return d;
  return Math.max(0, Math.min(1, v));
}

/**
 * Returns a function you give to CanvasTextureBridge.
 * That fn receives (p, timeSec, width, height) each frame.
 */
export function initShapeField(params: ShapeFieldParams = {}) {
  const rows = params.rows ?? 12;
  const liveAvg = clamp01(params.liveAvg, 0.5);
  const allocAvg = clamp01(params.allocAvg, 0.5); // controls density
  const weights = params.weights ?? {};
  const seed = params.seed ?? 1337;

  // Precompute a stable order of shape keys we’ll try to place
  const shapeKeys = Object.keys(SHAPES) as (keyof typeof SHAPES)[];

  // How many attempts per shape? Map weight 0..1 to attempts 0..N
  const MAX_ATTEMPTS_PER_SHAPE = 18;
  const attemptsFor = (w: number) =>
    Math.round(clamp01(w) * MAX_ATTEMPTS_PER_SHAPE * (0.5 + allocAvg * 0.9));

  return function drawIntoTexture(p: Q5, tSec: number, W: number, H: number) {
    // grid: 12 rows tall; square tiles → derive cols from width
    const tile = Math.max(8, Math.floor(H / rows));
    const cols = Math.max(1, Math.floor(W / tile));
    const used = new Set<string>();

    // clear
    p.clear(0, 0, 0, 0);

    // subtle paper-ish bg tint (optional, can remove)
    p.noStroke();
    p.fill(255, 255, 255, 18);
    p.rect(0, 0, W, H);

    const rng = makeRng(seed);

    // helper: get center of tile (cx, cy) from (r, c)
    const tileCenter = (r: number, c: number) => {
      const x = c * tile + tile / 2;
      const y = r * tile + tile / 2;
      return [x, y];
    };

    // Lane-ish iteration: walk rows, then pick cols with jitter so it’s even-ish
    function placeShape(name: string, count: number) {
      const draw = SHAPES[name];
      if (!draw || count <= 0) return;

      // base color: lerp against shape palette’s default using liveAvg
      const baseRGB = getBaseRGB(name as any) || { r: 220, g: 230, b: 240 };
      const a = Math.round(140 + liveAvg * 90);
      const color = { ...baseRGB, a };

      let placed = 0;
      let row = 0;
      let colCursor = Math.floor((rng() * 0.25 + 0.05) * cols); // offset start

      const maxIters = count * 8; // guard
      let iters = 0;

      while (placed < count && iters < maxIters) {
        iters++;
        // wrap row/col
        if (colCursor >= cols) {
          colCursor = Math.floor((rng() * 0.3 + 0.1) * cols);
          row++;
        }
        if (row >= rows) row = 0;

        // jitter column stride: sometimes skip 1–2 cols to create lanes
        const stride = 1 + (rng() < 0.65 ? 1 : (rng() < 0.5 ? 2 : 0));
        const c = colCursor;
        colCursor += stride;

        // Occupancy check
        const key = `${row}:${c}`;
        if (used.has(key)) continue;

        const [cx, cy] = tileCenter(row, c);

        // Size within tile (keep padding so shapes don’t bleed)
        const pad = tile * 0.12;
        const size = tile - pad * 2;

        // Optional animated scale with liveAvg
        const sc = 0.85 + liveAvg * 0.25;

        // Draw — we pass a minimal opts object shapes already accept
        try {
          draw(p, cx, cy, size * sc, {
            color,
            mods: undefined,
            tSec,
          });
          used.add(key);
          placed++;
        } catch (e) {
          // if a particular shape throws, don’t break the whole pass
          // eslint-disable-next-line no-console
          console.warn(`[initShapeField] draw ${name} failed:`, e);
        }
      }
    }

    // Order by weight (higher first) so big items grab tiles early
    const entries = shapeKeys
      .map((k) => ({ name: k as string, w: clamp01((weights as any)[k] ?? 0) }))
      .filter((e) => e.w > 0)
      .sort((a, b) => b.w - a.w);

    for (const e of entries) {
      placeShape(e.name, attemptsFor(e.w));
    }
  };
}
