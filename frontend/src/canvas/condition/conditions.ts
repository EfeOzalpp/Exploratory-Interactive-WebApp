// src/canvas/condition/conditions.ts
export type ShapeKind =
  | 'clouds'
  | 'snow'
  | 'house'
  | 'power'
  | 'sun'
  | 'villa'
  | 'plus'
  | 'line';

export type ConditionKind = 'A' | 'B' | 'C' | 'D';

export type Variant = {
  shape: ShapeKind;
  footprint: { w: number; h: number }; // grid cells
};

export type ConditionSpec = {
  variants: [Variant, Variant]; // 50/50
};

export const CONDITIONS: Record<ConditionKind, ConditionSpec> = {
  A: {
    variants: [
      { shape: 'clouds', footprint: { w: 2, h: 3 } },
      { shape: 'sun',    footprint: { w: 2, h: 2 } },
    ],
  },
  B: {
    variants: [
      { shape: 'snow', footprint: { w: 1, h: 3 } },
      { shape: 'villa', footprint: { w: 2, h: 2 } },
    ],
  },
  C: {
    variants: [
      { shape: 'house',  footprint: { w: 1, h: 3 } },
      { shape: 'power',     footprint: { w: 1, h: 3 } },
    ],
  },
  D: {
    variants: [
      { shape: 'plus', footprint: { w: 1, h: 1 } },
      { shape: 'line',    footprint: { w: 1, h: 1 } }, // horizontal line glyph
    ],
  },
};

/** FNV-1a 32-bit (fast, stable) */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Murmur3 fmix32 finalizer to thoroughly mix 32-bit seeds */
function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Sticky, unbiased 50/50 variant picker:
 * - Deterministic by (kind, id, salt)
 * - Uses a mixed hash and a single bit for selection (no PRNG draw)
 * - Optional `salt` lets you reshuffle globally without breaking determinism
 */
export function pickVariant(kind: ConditionKind, id: number, salt = 0) {
  const spec = CONDITIONS[kind];

  // Compose a stable seed from kind, id, and an optional salt
  // Knuth’s constant 0x9e3779b9 helps decorrelate sequential ids
  const seed =
    (hashStr(kind) ^
      Math.imul((id >>> 0) + (salt >>> 0), 0x9e3779b9)) >>> 0;

  // Thoroughly mix, then use a single high-quality bit for 50/50
  const h = fmix32(seed);
  const useFirst = (h & 1) === 0;

  return useFirst ? spec.variants[0] : spec.variants[1];
}
