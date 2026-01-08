// modifiers/shape-modifiers/geom.ts
import { phaseFromIndex } from "../../shared/utils/hash32.ts";

export type Lobe = { x: number; y: number; r: number; i: number };

export function makeArchLobes(
  cx: number,
  cy: number,
  width: number,
  height: number,
  opts: {
    count?: number;
    spreadX?: number;
    arcLift?: number;
    rBase?: number | null;
    rJitter?: number;
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
  const r0 = rBase ?? Math.min(width, height) * 0.34;

  for (let i = 0; i < count; i++) {
    const u = count === 1 ? 0.5 : i / (count - 1);
    const x = cx - W / 2 + u * W;
    const arch = Math.sin(u * Math.PI);
    const y = cy - arch * (height * arcLift);

    const ph = phaseFromIndex(i, seed);
    const jitter = 1 + Math.sin(ph) * rJitter;
    const r = r0 * jitter * (0.85 + arch * 0.3);

    lobes.push({ x, y, r, i });
  }

  return lobes;
}
