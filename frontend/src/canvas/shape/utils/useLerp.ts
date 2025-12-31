// src/canvas/shape/utils/useLerp.ts
// Minimal lerp helpers shared across shapes/effects.
// import the functions directly OR call useLerp() to get them.

export type Range = [number, number];

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** v can be a number or [min,max]; u is 0..1 */
export function val(v: number | Range, u: number): number {
  return Array.isArray(v) ? mix(v[0], v[1], clamp01(u)) : v;
}

// Optional ergonomic hook-style wrapper (handy in React files)
export default function useLerp() {
  return { clamp01, mix, val };
}
