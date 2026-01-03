// graph-runtime/sprites/selection/shapeForAvg.ts
import type { ShapeKey } from './types';

const SHAPES: ShapeKey[] = [
  'clouds', 'snow', 'house', 'power', 'sun', 'villa',
  'car', 'sea', 'carFactory', 'bus', 'trees',
];

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

function hash01(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

function prng(seedStr: string) {
  let x = Math.max(1, Math.floor(hash01(seedStr) * 0xffffffff)) >>> 0;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 0xffffffff;
  };
}

function permute<T>(arr: T[], seedStr: string): T[] {
  const out = arr.slice();
  const rnd = prng(seedStr);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function shapeForAvg(
  avgIn: number,
  seed?: string | number,
  orderIndex?: number
): ShapeKey {
  const n = SHAPES.length;
  const a = clamp01(Number.isFinite(avgIn) ? avgIn : 0.5);

  if (Number.isFinite(orderIndex as number)) {
    const idx = Math.max(0, Math.floor(orderIndex as number));
    const seedStr = seed == null ? 'seed:default' : String(seed);

    const batch = Math.floor(idx / n);
    const pos = idx % n;
    const perm = permute(SHAPES, `perm:${seedStr}:b${batch}`);
    return perm[pos];
  }

  const base = Math.min(n - 1, Math.floor(a * n));

  const seedStr = seed == null ? 'seed:default' : String(seed);
  const rot = Math.floor(hash01(`rot:${seedStr}`) * n) % n;

  const pick = (base + rot) % n;
  return SHAPES[pick];
}

export type { ShapeKey };
