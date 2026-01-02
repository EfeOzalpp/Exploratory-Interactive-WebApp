// src/canvas/condition/conditionMix.ts
export type ConditionKind = 'A' | 'B' | 'C' | 'D';

export type Mix4 = readonly [number, number, number, number];
export type Mix4Int = [number, number, number, number];

export type Anchor = { t: number; mix20: Mix4 };

const DEFAULT_ANCHORS: readonly Anchor[] = [
  { t: 0.0, mix20: [2, 4, 10, 8] },
  { t: 0.25, mix20: [4, 6, 10, 4] },
  { t: 0.5, mix20: [5, 7, 7, 5] },
  { t: 0.75, mix20: [4, 10, 6, 4] },
  { t: 1.0, mix20: [10, 9, 3, 4] },
];

const clamp01 = (v?: number) =>
  typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export type TMapper = (t: number) => number;

/**
 * Builds a piecewise-linear mapper from checkpoints in slider space (x) to logical space (y).
 * Input and output are clamped to [0..1].
 */
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

/**
 * Identity mapper for cases where the slider is already in logical space.
 */
export const identityTMapper: TMapper = (t) => clamp01(t);

/**
 * Interpolates the 4-way mix at a given slider value, after applying the optional mapper.
 * Anchors are a set of keyed mixes along t in [0..1] and are interpolated linearly.
 */
export function interpolateConditionMix20(
  avgSlider: number | undefined,
  opts?: { anchors?: readonly Anchor[]; tMapper?: TMapper }
): Mix4Int {
  const anchors = (opts?.anchors?.length ? opts.anchors : DEFAULT_ANCHORS)
    .slice()
    .sort((a, b) => a.t - b.t);

  const mapT = opts?.tMapper ?? identityTMapper;
  const t = clamp01(mapT(clamp01(avgSlider)));

  let i = 0;
  while (i < anchors.length - 1 && t > anchors[i + 1].t) i++;

  const A = anchors[i];
  const B = anchors[Math.min(i + 1, anchors.length - 1)];

  if (A.t === B.t) return [...A.mix20] as Mix4Int;

  const k = (t - A.t) / Math.max(1e-6, B.t - A.t);
  return [
    lerp(A.mix20[0], B.mix20[0], k),
    lerp(A.mix20[1], B.mix20[1], k),
    lerp(A.mix20[2], B.mix20[2], k),
    lerp(A.mix20[3], B.mix20[3], k),
  ];
}

/**
 * Scales an array of non-negative floats into 4 integer buckets that sum exactly to K.
 * Uses the Largest Remainder method, which preserves the overall proportions closely.
 */
export function scaleMixToCount(floatMix: readonly number[], K: number): Mix4Int {
  if (K <= 0) return [0, 0, 0, 0];

  const sum = floatMix.reduce((a, b) => a + b, 0);
  const factor = K / (sum || 1);

  const scaled = floatMix.map((v) => v * factor);
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
 * Convenience helper to go from slider value to exact integer counts for a given total.
 */
export function countsFromSlider(
  sliderT: number | undefined,
  total: number,
  opts?: { anchors?: readonly Anchor[]; tMapper?: TMapper }
): Mix4Int {
  return scaleMixToCount(interpolateConditionMix20(sliderT, opts), total);
}

const KINDS: readonly ConditionKind[] = ['A', 'B', 'C', 'D'];

/**
 * Retargets an existing list of condition kinds to match new target counts with minimal churn.
 * It only changes as many positions as necessary, pulling from the most overrepresented kind.
 */
export function adjustConditionsStable(
  current: ConditionKind[],
  targetCounts: Mix4Int
): ConditionKind[] {
  const N = current.length;
  if (N === 0) return [];

  const target = scaleMixToCount(targetCounts, N);

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
