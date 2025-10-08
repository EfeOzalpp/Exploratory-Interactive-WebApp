// src/canvas/condition/conditionMix.ts
export type ConditionKind = 'A' | 'B' | 'C' | 'D';
export type Mix4 = [number, number, number, number];

export type Anchor = { t: number; mix20: Mix4 };

/** Default anchors (unchanged) */
const DEFAULT_ANCHORS: Anchor[] = [
  { t: 0.00, mix20: [ 2, 4, 10, 8] },
  { t: 0.25, mix20: [ 4, 6, 10, 4] },
  { t: 0.50, mix20: [ 5, 7,  7, 5] },
  { t: 0.75, mix20: [ 4,10,  6, 4] },
  { t: 1.00, mix20: [10, 9,  3, 4] },
];

const clamp01 = (v?: number) => (typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/* ────────────────────────────────────────────────────────────────────────────
   Non-linear slider → avg mapping
   - Define checkpoints in slider space (x in [0..1]) to map to logical avg (y).
   - If omitted, mapper is identity (avg = slider).
   Example checkpoints: [{x:0,y:0},{x:0.2,y:0.05},{x:0.5,y:0.4},{x:1,y:1}]
   ──────────────────────────────────────────────────────────────────────────── */

export type TMapper = (t: number) => number;

/** Build a piecewise-linear mapper from checkpoints. */
export function makeTMapper(checkpoints: Array<{ x: number; y: number }>): TMapper {
  const pts = [...checkpoints].sort((a, b) => a.x - b.x);
  if (!pts.length) return (t) => clamp01(t);
  return (tIn: number) => {
    let t = clamp01(tIn);
    if (t <= pts[0].x) return pts[0].y;
    if (t >= pts[pts.length - 1].x) return pts[pts.length - 1].y;
    // find segment
    let i = 0;
    while (i < pts.length - 1 && t > pts[i + 1].x) i++;
    const A = pts[i], B = pts[i + 1];
    const k = (t - A.x) / Math.max(1e-6, (B.x - A.x));
    return lerp(A.y, B.y, k);
  };
}

/* Identity mapper (slider is already in logical avg space) */
export const identityTMapper: TMapper = (t) => clamp01(t);

/* ────────────────────────────────────────────────────────────────────────────
   Mix interpolation + helpers
   ──────────────────────────────────────────────────────────────────────────── */

export function interpolateConditionMix20(
  avgSlider: number | undefined,
  opts?: {
    anchors?: Anchor[];
    tMapper?: TMapper;   // maps slider → logical avg before anchor interpolation
  }
): Mix4 {
  const anchors = (opts?.anchors?.length ? opts.anchors : DEFAULT_ANCHORS).slice().sort((a,b)=>a.t-b.t);
  const mapT = opts?.tMapper ?? identityTMapper;

  const t = clamp01(mapT(clamp01(avgSlider)));
  let i = 0;
  while (i < anchors.length - 1 && t > anchors[i + 1].t) i++;
  const A = anchors[i];
  const B = anchors[Math.min(i + 1, anchors.length - 1)];
  if (A.t === B.t) return [...A.mix20] as Mix4;
  const k = (t - A.t) / Math.max(1e-6, (B.t - A.t));
  return [
    lerp(A.mix20[0], B.mix20[0], k),
    lerp(A.mix20[1], B.mix20[1], k),
    lerp(A.mix20[2], B.mix20[2], k),
    lerp(A.mix20[3], B.mix20[3], k),
  ];
}

/** Largest Remainder to scale floats to exact K */
export function scaleMixToCount(floatMix: Mix4, K: number): Mix4 {
  const sum = floatMix[0] + floatMix[1] + floatMix[2] + floatMix[3];
  const factor = K / (sum || 1);
  const floats = floatMix.map(v => v * factor);
  const floors = floats.map(Math.floor) as Mix4;
  let used = floors[0] + floors[1] + floors[2] + floors[3];
  const rema = floats.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac);
  const out = [...floors] as Mix4;
  let idx = 0;
  while (used < K && idx < rema.length) { out[rema[idx].i]++; used++; idx++; }
  return out;
}

/** Convenience: slider (non-linear) → exact counts */
export function countsFromSlider(
  sliderT: number | undefined,
  total: number,
  opts?: { anchors?: Anchor[]; tMapper?: TMapper }
): Mix4 {
  return scaleMixToCount(interpolateConditionMix20(sliderT, opts), total);
}

/* ────────────────────────────────────────────────────────────────────────────
   Minimal-churn, sticky condition adjustment (unchanged logic)
   ──────────────────────────────────────────────────────────────────────────── */

const KINDS: ConditionKind[] = ['A', 'B', 'C', 'D'];

export function adjustConditionsStable(
  current: ConditionKind[],
  targetCounts: Mix4
): ConditionKind[] {
  const N = current.length;

  // Clamp target to N items total
  const tgtSum = targetCounts[0] + targetCounts[1] + targetCounts[2] + targetCounts[3];
  let target = [...targetCounts] as Mix4;
  if (tgtSum !== N) {
    const factor = N / (tgtSum || 1);
    const scaled = target.map(v => v * factor);
    const floors = scaled.map(Math.floor) as Mix4;
    let used = floors[0] + floors[1] + floors[2] + floors[3];
    const rema = scaled.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac);
    const out = [...floors] as Mix4;
    let idx = 0;
    while (used < N && idx < rema.length) { out[rema[idx].i]++; used++; idx++; }
    target = out;
  }

  // Index lists for each kind
  const idxBy: Record<ConditionKind, number[]> = { A: [], B: [], C: [], D: [] };
  current.forEach((k, i) => idxBy[k].push(i));

  const curCounts: Mix4 = [idxBy.A.length, idxBy.B.length, idxBy.C.length, idxBy.D.length];
  const need    = target.map((t, i) => t - curCounts[i]) as Mix4;
  const surplus = target.map((t, i) => curCounts[i] - t) as Mix4;

  const out = current.slice();

  const largestSurplusKind = () => {
    let bestK = -1, bestVal = -Infinity;
    for (let k = 0; k < 4; k++) if (surplus[k] > bestVal) { bestVal = surplus[k]; bestK = k; }
    return bestVal > 0 ? bestK : -1;
  };

  for (let kNeed = 0; kNeed < 4; kNeed++) {
    while (need[kNeed] > 0) {
      const donor = largestSurplusKind();
      if (donor === -1) break;

      const donorKind = KINDS[donor];
      const idx = idxBy[donorKind].pop();
      if (idx == null) { surplus[donor] = 0; continue; }

      out[idx] = KINDS[kNeed];
      surplus[donor]--;
      need[kNeed]--;
      idxBy[KINDS[kNeed]].push(idx);
    }
  }

  return out;
}
