// src/canvas/shared/hash32.ts
export function fnv1a32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function hash32(tag: string, id: number, salt = 0): number {
  const seed =
    (fnv1a32(tag) ^ Math.imul(((id >>> 0) + (salt >>> 0)) >>> 0, 0x9e3779b9)) >>> 0;
  return fmix32(seed);
}

export function hashString32(key: string): number {
  return fmix32(fnv1a32(key));
}

export function rand01FromString(key: string): number {
  const h = hashString32(key);
  return ((h >>> 8) & 0xffff) / 0xffff;
}

export function rand01(tag: string, id: number, salt = 0): number {
  const h = hash32(tag, id, salt);
  return ((h >>> 8) & 0xffff) / 0xffff;
}

/**
 * Deterministic 32-bit hash -> pseudo-random phase (0..2π)
 * Kept for visual stability in geom/osc wobble.
 */
export function phaseFromIndex(idx: number, seed = 0): number {
  let t = (idx + (seed >>> 0)) ^ 0x9e3779b9;
  t ^= t >>> 15;
  t = Math.imul(t, 0x85ebca6b);
  t ^= t >>> 13;
  t = Math.imul(t, 0xc2b2ae35);
  t ^= t >>> 16;
  return (Math.abs(t) % 628318530) / 1e8;
}

/**
 * Aliases kept for readability at call sites.
 * Use these when you are hashing arbitrary composite keys.
 */
export const hash32String = hashString32;
export const rand01Keyed = rand01FromString;
