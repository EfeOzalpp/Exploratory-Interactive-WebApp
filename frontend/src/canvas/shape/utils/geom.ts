import { phaseFromIndex } from './hash.ts';

export type Lobe = { x: number; y: number; r: number; i: number };

/**
 * Evenly spaced lobe centers along an arch.
 * width/height define the layout envelope; (cx, cy) is the center anchor.
 */
export function makeArchLobes(
  cx: number,
  cy: number,
  width: number,
  height: number,
  opts: {
    count?: number;
    spreadX?: number;   // fraction of width covered by centers
    arcLift?: number;   // fraction of height to lift middle
    rBase?: number | null;
    rJitter?: number;   // 0..1 radius jitter
    seed?: number;
  } = {}
): Lobe[] {
  const {
    count = 7,
    spreadX = 0.92,
    arcLift = 0.32,
    rBase = null,
    rJitter = 0.12,
    seed = 0,
  } = opts;

  const lobes: Lobe[] = [];
  const W = width * spreadX;
  const step = count > 1 ? W / (count - 1) : 0;
  const r0 = rBase ?? Math.min(width, height) * 0.34;

  for (let i = 0; i < count; i++) {
    const u = count === 1 ? 0.5 : i / (count - 1);
    const x = cx - W / 2 + u * W;
    const arch = Math.sin(u * Math.PI);      // 0..1..0
    const y = cy - arch * (height * arcLift);

    const ph = phaseFromIndex(i, seed);
    const jitter = 1 + Math.sin(ph) * rJitter;
    const r = r0 * jitter * (0.85 + arch * 0.3);

    lobes.push({ x, y, r, i });
  }
  return lobes;
}
