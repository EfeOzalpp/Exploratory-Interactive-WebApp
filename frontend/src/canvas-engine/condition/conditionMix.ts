// src/canvas/condition/conditionMix.ts
import type { ConditionKind } from './types.ts';

export type Mix4 = readonly [number, number, number, number];
export type Mix4Int = [number, number, number, number];

export type Anchor = { t: number; weights: Mix4 };

// Default distribution curve for conditions A/B/C/D.
// Each anchor gives RELATIVE weights at normalized control t ∈ [0..1].
// These weights are scaled to the current pool size N via Largest Remainder.
const DEFAULT_ANCHORS: readonly Anchor[] = [
  { t: 0.0, weights: [2, 4, 10, 8] },
  { t: 0.25, weights: [4, 6, 10, 4] },
  { t: 0.5, weights: [5, 7, 7, 5] },
  { t: 0.75, weights: [4, 10, 6, 4] },
  { t: 1.0, weights: [10, 9, 3, 4] },
];

const clamp01 = (v?: number) =>
  typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export type TMapper = (t: number) => number;

export function makeTMapper(
  checkpoints: Array<{ x: number; y: number }>
): TMapper {
  const pts = [...checkpoints].sort((a, b) => a.x - b.x);
  if (!pts.length) return (t) => clamp01(t);

  return (tIn: number) => {
    const t = clamp01(tIn);

    if (t <= pts[0].x) return clamp01(pts[0].y);
    if (t >= pts[pts.length - 1].x) return clamp01(pts[pts.length - 1].y);

    let i = 0;
    while (i < pts.length - 1 && t > pts[i + 1].x) i++;

    const A = pts[i];
    const B = pts[i + 1];
    const denom = Math.max(1e-6, B.x - A.x);
    const k = (t - A.x) / denom;
    return clamp01(lerp(A.y, B.y, k));
  };
}

export const identityTMapper: TMapper = (t) => clamp01(t);

const KINDS: readonly ConditionKind[] = ['A', 'B', 'C', 'D'] as const;

function argMax4(v: readonly number[]) {
  let best = 0;
  for (let i = 1; i < 4; i++) if (v[i] > v[best]) best = i;
  return best;
}

/**
 * Interpolates the 4-way weight vector at a given slider value.
 * NOTE: returns floats (weights), not counts.
 */
export function interpolateConditionWeights(
  avgSlider: number | undefined,
  opts?: { anchors?: readonly Anchor[]; tMapper?: TMapper }
): Mix4 {
  const anchors = (opts?.anchors?.length ? opts.anchors : DEFAULT_ANCHORS)
    .slice()
    .sort((a, b) => a.t - b.t);

  const mapT = opts?.tMapper ?? identityTMapper;
  const t = clamp01(mapT(clamp01(avgSlider)));

  let i = 0;
  while (i < anchors.length - 1 && t > anchors[i + 1].t) i++;

  const A = anchors[i];
  const B = anchors[Math.min(i + 1, anchors.length - 1)];

  if (A.t === B.t) return A.weights;

  const k = (t - A.t) / Math.max(1e-6, B.t - A.t);
  return [
    lerp(A.weights[0], B.weights[0], k),
    lerp(A.weights[1], B.weights[1], k),
    lerp(A.weights[2], B.weights[2], k),
    lerp(A.weights[3], B.weights[3], k),
  ];
}

/**
 * Scales non-negative floats into 4 integer buckets that sum exactly to K.
 * Largest Remainder method.
 */
export function scaleMixToCount(floatMix: readonly number[], K: number): Mix4Int {
  if (K <= 0) return [0, 0, 0, 0];

  const sum = floatMix.reduce((a, b) => a + b, 0);
  const factor = K / (sum || 1);

  const scaled = floatMix.map((v) => Math.max(0, v) * factor);
  const floors = scaled.map((v) => Math.floor(v));
  let used = floors.reduce((a, b) => a + b, 0);

  const rema = scaled
    .map((v, i) => ({ i, frac: v - floors[i] }))
    .sort((a, b) => b.frac - a.frac);

  const out = floors.slice();
  let idx = 0;
  while (used < K && idx < rema.length) {
    out[rema[idx].i] += 1;
    used += 1;
    idx += 1;
  }

  return [out[0] | 0, out[1] | 0, out[2] | 0, out[3] | 0];
}

/**
 * Pool-size-aware counts:
 * (liveAvg, total N) -> integer counts summing to N.
 *
 * Adds one policy guard for small N:
 * - Ensure the currently dominant weight kind is present when N>0 (if possible).
 */
export function countsFromSlider(
  sliderT: number | undefined,
  total: number,
  opts?: { anchors?: readonly Anchor[]; tMapper?: TMapper; ensureDominant?: boolean }
): Mix4Int {
  if (total <= 0) return [0, 0, 0, 0];

  const weights = interpolateConditionWeights(sliderT, opts);
  let counts = scaleMixToCount(weights, total);

  if (opts?.ensureDominant !== false && total > 0) {
    const dom = argMax4(weights);
    if (counts[dom] === 0) {
      // steal 1 from the largest donor (prefer donors with >1)
      let donor = -1;
      let best = 0;
      for (let i = 0; i < 4; i++) {
        if (i === dom) continue;
        if (counts[i] > best) {
          best = counts[i];
          donor = i;
        }
      }
      if (donor !== -1 && counts[donor] > 0) {
        const out = [...counts] as Mix4Int;
        out[donor] -= 1;
        out[dom] += 1;
        counts = out;
      }
    }
  }

  return counts;
}

/**
 * Retargets an existing list of condition kinds to match new target counts with minimal churn.
 * IMPORTANT: targetCounts are COUNTS (already sum to N). Do NOT rescale them like weights.
 */
export function adjustConditionsStable(
  current: ConditionKind[],
  targetCounts: Mix4Int
): ConditionKind[] {
  const N = current.length;
  if (N === 0) return [];

  const sum =
    (targetCounts[0] | 0) +
    (targetCounts[1] | 0) +
    (targetCounts[2] | 0) +
    (targetCounts[3] | 0);

  // Normalize only if caller gave a vector that doesn't sum to N.
  const target: Mix4Int =
    sum === N ? [...targetCounts] as Mix4Int : scaleMixToCount(targetCounts, N);

  const idxBy: Record<ConditionKind, number[]> = { A: [], B: [], C: [], D: [] };
  current.forEach((k, i) => idxBy[k].push(i));

  const curCounts: Mix4Int = [
    idxBy.A.length,
    idxBy.B.length,
    idxBy.C.length,
    idxBy.D.length,
  ];

  const need: Mix4Int = [
    target[0] - curCounts[0],
    target[1] - curCounts[1],
    target[2] - curCounts[2],
    target[3] - curCounts[3],
  ];

  const surplus: Mix4Int = [
    curCounts[0] - target[0],
    curCounts[1] - target[1],
    curCounts[2] - target[2],
    curCounts[3] - target[3],
  ];

  const out = current.slice();

  const largestSurplusKind = () => {
    let bestK = -1;
    let bestVal = 0;
    for (let k = 0; k < 4; k++) {
      if (surplus[k] > bestVal) {
        bestVal = surplus[k];
        bestK = k;
      }
    }
    return bestK;
  };

  for (let kNeed = 0; kNeed < 4; kNeed++) {
    while (need[kNeed] > 0) {
      const donor = largestSurplusKind();
      if (donor === -1) break;

      const donorKind = KINDS[donor];
      const idx = idxBy[donorKind].pop();
      if (idx == null) {
        surplus[donor] = 0;
        continue;
      }

      out[idx] = KINDS[kNeed];
      surplus[donor] -= 1;
      need[kNeed] -= 1;
      idxBy[KINDS[kNeed]].push(idx);
    }
  }

  return out;
}
