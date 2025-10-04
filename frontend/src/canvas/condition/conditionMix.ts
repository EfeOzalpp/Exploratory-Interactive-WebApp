// src/canvas/condition/conditionMix.ts
export type ConditionKind = 'A' | 'B' | 'C' | 'D';

/**
 * Anchor distributions at a base total of 20 items.
 * Order is [A, B, C, D]
 *
 * Matches the requested behavior:
 *  - t=0.00:  2 A, 3 B, 5 C, 10 D  (at least 2×A and 10×D; C > B)
 *  - t=0.25:  4 A, 4 B, 8 C,  4 D  (C more common than B)
 *  - t=0.50:  5 A, 5 B, 5 C,  5 D  (even)
 *  - t=0.75:  4 A, 8 B, 4 C,  4 D  (B more common than C)
 *  - t=1.00: 10 A, 5 B, 3 C,  2 D  (at least 10×A and 2×D; B > C)
 */
const ANCHORS: Array<{ t: number; mix20: [number, number, number, number] }> = [
  { t: 0.00, mix20: [ 2, 5,  7, 10] },
  { t: 0.25, mix20: [ 4, 6,  10,  4] },
  { t: 0.50, mix20: [ 5, 7,  7,  5] },
  { t: 0.75, mix20: [ 4, 10,  6,  4] },
  { t: 1.00, mix20: [10, 7,  5,  2] },
];

function clamp01(v: number | undefined) {
  return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5;
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Interpolate the anchor mixes at avg (0..1) to a float mix (~20 total) */
export function interpolateConditionMix20(avg: number | undefined): [number, number, number, number] {
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

/** Largest Remainder to scale floats to exact K */
export function scaleMixToCount(
  floatMix: [number, number, number, number],
  K: number
): [number, number, number, number] {
  const sum = floatMix[0] + floatMix[1] + floatMix[2] + floatMix[3];
  const factor = K / (sum || 1);
  const floats = floatMix.map(v => v * factor);
  const floors = floats.map(Math.floor);
  let used = floors[0] + floors[1] + floors[2] + floors[3];
  const rema = floats.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac);
  const out = [...floors] as [number, number, number, number];
  let idx = 0;
  while (used < K && idx < rema.length) { out[rema[idx].i]++; used++; idx++; }
  return out;
}

/** Round-robin expansion to interleave conditions spatially */
export function buildConditionSequence(counts: [number, number, number, number]): ConditionKind[] {
  const kinds: ConditionKind[] = ['A', 'B', 'C', 'D'];
  const left = [...counts];
  const result: ConditionKind[] = [];
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

/* ────────────────────────────────────────────────────────────────────────────
   Minimal-churn, sticky condition adjustment
   - Keeps each item’s existing kind unless we *must* reassign to meet target.
   - Returns a new array of kinds (same length as `current`).
   - If target sum ≠ current.length, we clamp to current.length.
   ──────────────────────────────────────────────────────────────────────────── */

const KINDS: ConditionKind[] = ['A', 'B', 'C', 'D'];

export function adjustConditionsStable(
  current: ConditionKind[],
  targetCounts: [number, number, number, number]
): ConditionKind[] {
  const N = current.length;

  // Clamp target to N items total (safety)
  const tgtSum = targetCounts[0] + targetCounts[1] + targetCounts[2] + targetCounts[3];
  let target = [...targetCounts] as [number, number, number, number];
  if (tgtSum !== N) {
    const factor = N / (tgtSum || 1);
    const scaled = target.map(v => v * factor);
    const floors = scaled.map(Math.floor);
    let used = floors[0] + floors[1] + floors[2] + floors[3];
    const rema = scaled.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac);
    const out = [...floors] as [number, number, number, number];
    let idx = 0;
    while (used < N && idx < rema.length) { out[rema[idx].i]++; used++; idx++; }
    target = out;
  }

  // Build index lists for each kind (so we know where existing items live)
  const idxBy: Record<ConditionKind, number[]> = { A: [], B: [], C: [], D: [] };
  current.forEach((k, i) => idxBy[k].push(i));

  // Current counts
  const curCounts: [number, number, number, number] = [
    idxBy.A.length, idxBy.B.length, idxBy.C.length, idxBy.D.length
  ];

  // Compute needs (>0 deficit) and surplus (>0 extra)
  const need    = target.map((t, i) => t - curCounts[i]) as [number, number, number, number];
  const surplus = target.map((t, i) => curCounts[i] - t) as [number, number, number, number];

  // Start with copy of current; we’ll only change what’s necessary.
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
