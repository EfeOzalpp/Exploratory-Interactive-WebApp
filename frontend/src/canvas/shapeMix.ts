export type ShapeKind = 'circle' | 'triangle' | 'square' | 'octagon';

/**
 * Anchor distributions at a base total of 20 items.
 * Order is [circle, triangle, square, octagon]
 */
const ANCHORS: Array<{ t: number; mix20: [number, number, number, number] }> = [
  { t: 0.00, mix20: [20, 0,  0,  0] },  // all circles
  { t: 0.25, mix20: [ 2, 3,  4, 11] },  // 2 circle, 3 tri, 4 sq, 11 oct
  { t: 0.50, mix20: [ 5, 5,  5,  5] },  // 5 each
  { t: 0.75, mix20: [11, 4,  2,  2] },  // 11 circle, 4 tri, 2 sq, 2 oct
  { t: 1.00, mix20: [ 0, 0,  0, 20] },  // all octagons
];

function clamp01(v: number | undefined) {
  return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5;
}

/** Linear interpolate between a and b by k in [0..1] */
function lerp(a: number, b: number, k: number) { return a + (b - a) * k; }

/**
 * Interpolate the anchor mixes at avg (0..1) to a float mix (sums to ~20).
 * Returns floats in the fixed order [circle, triangle, square, octagon].
 */
export function interpolateMix20(avg: number | undefined): [number, number, number, number] {
  const t = clamp01(avg);
  let i = 0;
  while (i < ANCHORS.length - 1 && t > ANCHORS[i + 1].t) i++;
  const A = ANCHORS[i];
  const B = ANCHORS[Math.min(i + 1, ANCHORS.length - 1)];
  if (A.t === B.t) return [...A.mix20] as any;
  const k = (t - A.t) / (B.t - A.t);
  return [
    lerp(A.mix20[0], B.mix20[0], k),
    lerp(A.mix20[1], B.mix20[1], k),
    lerp(A.mix20[2], B.mix20[2], k),
    lerp(A.mix20[3], B.mix20[3], k),
  ];
}

/**
 * Scale a float mix (summing to ~20) down/up to integer counts that sum exactly to K.
 * Largest Remainder / Huntington-Hill would both work; we’ll do Largest Remainder here.
 */
export function scaleMixToCount(float20: [number, number, number, number], K: number): [number, number, number, number] {
  const sum20 = float20[0] + float20[1] + float20[2] + float20[3];
  const factor = K / (sum20 || 1);
  const floats = float20.map(v => v * factor);
  const floors = floats.map(Math.floor);
  let used = floors[0] + floors[1] + floors[2] + floors[3];
  const rema = floats.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac);
  const out = [...floors] as [number, number, number, number];
  let idx = 0;
  while (used < K && idx < rema.length) { out[rema[idx].i]++; used++; idx++; }
  // Guard against over-allocation (shouldn't happen, but safe)
  while (used > K) {
    // remove from the smallest remainder first
    rema.sort((a, b) => a.frac - b.frac);
    const j = rema.shift();
    if (!j) break;
    if (out[j.i] > 0) { out[j.i]--; used--; }
  }
  return out;
}

/**
 * Build a shape sequence array of length K using round-robin expansion
 * so shapes are spatially interleaved (not big blocks).
 */
export function buildShapeSequence(counts: [number, number, number, number]): ShapeKind[] {
  const kinds: ShapeKind[] = ['circle', 'triangle', 'square', 'octagon'];
  const left = [...counts];
  const result: ShapeKind[] = [];
  let exhausted = false;
  while (!exhausted) {
    exhausted = true;
    for (let k = 0; k < kinds.length; k++) {
      if (left[k] > 0) {
        result.push(kinds[k]);
        left[k]--;
        exhausted = false;
      }
    }
  }
  return result;
}
