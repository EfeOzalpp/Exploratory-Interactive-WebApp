// shapeForAvg.ts
export type ShapeKey =
  | 'clouds' | 'snow' | 'house' | 'power' | 'sun' | 'villa'
  | 'car' | 'sea' | 'carFactory' | 'bus' | 'trees';

const SHAPES: ShapeKey[] = [
  'clouds', 'snow', 'house', 'power', 'sun', 'villa',
  'car', 'sea', 'carFactory', 'bus', 'trees',
];

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

/** Deterministic 0..1 hash from string */
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

/** Tiny seeded PRNG (xorshift32-ish) returning [0,1) */
function prng(seedStr: string) {
  let x = Math.max(1, Math.floor(hash01(seedStr) * 0xffffffff)) >>> 0;
  return () => {
    // xorshift
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 0xffffffff;
  };
}

/** Fisher–Yates permutation with deterministic RNG */
function permute<T>(arr: T[], seedStr: string): T[] {
  const out = arr.slice();
  const rnd = prng(seedStr);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * shapeForAvg(avg, seed, orderIndex?)
 *
 * Batch-coverage mode (when orderIndex is provided):
 *   - Every consecutive block of SHAPES.length produces a fresh seeded permutation,
 *     so each block contains exactly one of each shape.
 *
 * Legacy mode (when orderIndex is NOT provided):
 *   - avg defines a base bucket; we rotate the whole list by a FULL 0..n-1 offset
 *     derived from the seed. This prevents “starving” shapes when avg clusters.
 */
export function shapeForAvg(
  avgIn: number,
  seed?: string | number,
  orderIndex?: number
): ShapeKey {
  const n = SHAPES.length;
  const a = clamp01(Number.isFinite(avgIn) ? avgIn : 0.5);

  // -------- Batch coverage mode (guaranteed one-of-each per block) --------
  if (Number.isFinite(orderIndex as number)) {
    const idx = Math.max(0, Math.floor(orderIndex as number));
    const seedStr = seed == null ? 'seed:default' : String(seed);

    // Each block of n gets its own permutation → full coverage every block
    const batch = Math.floor(idx / n);
    const pos = idx % n;
    const perm = permute(SHAPES, `perm:${seedStr}:b${batch}`);
    return perm[pos];
  }

  // -------- Legacy behavior (no index provided) --------
  // Base bucket from avg
  const base = Math.min(n - 1, Math.floor(a * n));

  // FULL rotation 0..n-1 from seed (restored)
  const seedStr = seed == null ? 'seed:default' : String(seed);
  const rot = Math.floor(hash01(`rot:${seedStr}`) * n) % n;

  const pick = (base + rot) % n;
  return SHAPES[pick];
}
