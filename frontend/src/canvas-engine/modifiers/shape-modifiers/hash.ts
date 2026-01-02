// Deterministic 32-bit hash → pseudo-random phase (0..2π)
export function phaseFromIndex(idx: number, seed = 0): number {
  let t = (idx + (seed >>> 0)) ^ 0x9e3779b9;
  t ^= t >>> 15; t = Math.imul(t, 0x85ebca6b);
  t ^= t >>> 13; t = Math.imul(t, 0xc2b2ae35);
  t ^= t >>> 16;
  // map to [0, 2π)
  return (Math.abs(t) % 628318530) / 1e8; // ~2π with integer math
}
