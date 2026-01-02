// src/components/survey/questions/scoring.ts
import type { Question } from '../types';

export type ShapeKey = 'circle' | 'square' | 'triangle' | 'diamond';

/** Base cap before shape deactivations. */
export const BASE_BUCKET_CAP = 2;
/** Cap reduction per deactivated shape. */
export const CAP_STEP_PER_DEACTIVATED = 0.5;
/**
 * Factor threshold to consider a shape "deactivated".
 * Keep this small; it should track your SelectionMap dead-band.
 */
export const DEACTIVATE_EPS = 0.01; // tweak to 0.02 if your UI feels better

const keyToShape = (key: string): ShapeKey => {
  const k = key.toUpperCase();
  if (k === 'A') return 'circle';
  if (k === 'B') return 'square';
  if (k === 'C') return 'triangle';
  return 'diamond'; // D
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Unweighted mean of base weights for a neutral prior per question */
export function questionPriorMean(q: Question): number {
  if (!q.options?.length) return 0;
  const s = q.options.reduce((acc, o) => acc + Number(o.weight ?? 0), 0);
  return s / q.options.length;
}

/**
 * Compute within-question signal s_q using normalized shares (keeps values like 0.4 intact),
 * and a dynamic utilization cap that shrinks by 0.5 for each deactivated shape.
 */
export function computeQuestionSignal(
  question: Question,
  factors: Record<ShapeKey, number>
): { signal: number; utilization: number; sumFactors: number; cap: number } {
  // Sum of (non-negative) factors
  const allKeys: ShapeKey[] = ['circle', 'square', 'triangle', 'diamond'];
  const clamped: Record<ShapeKey, number> = {
    circle: Math.max(0, Number(factors.circle ?? 0)),
    square: Math.max(0, Number(factors.square ?? 0)),
    triangle: Math.max(0, Number(factors.triangle ?? 0)),
    diamond: Math.max(0, Number(factors.diamond ?? 0)),
  };

  const S = allKeys.reduce((acc, k) => acc + clamped[k], 0);

  // Count "deactivated" shapes (≈ zero factor)
  const deactivatedCount = allKeys.reduce(
    (n, k) => n + (clamped[k] <= DEACTIVATE_EPS ? 1 : 0),
    0
  );

  // Dynamic cap: 2.0 - 0.5 * (#deactivated), but never below 0.5
  const dynamicCap = Math.max(0.5, BASE_BUCKET_CAP - CAP_STEP_PER_DEACTIVATED * deactivatedCount);

  if (S <= 0) {
    // No allocation → fall back to the prior (neutral)
    return { signal: questionPriorMean(question), utilization: 0, sumFactors: 0, cap: dynamicCap };
  }

  // Relative shares (unchanged logic) — shapes turned off (≈0) simply don't contribute
  const signal = question.options.reduce((acc, opt) => {
    const shape = keyToShape(opt.key);
    const f = clamped[shape];
    const p = f / S; // normalized share
    const base = Math.max(0, Number(opt.weight ?? 0));
    return acc + p * base;
  }, 0);

  // Utilization scales with the *dynamic* cap
  const utilization = clamp01(S / dynamicCap);

  return { signal, utilization, sumFactors: S, cap: dynamicCap };
}

/** Roll up all questions — dilution strategy (utilization * signal) */
export function computeSurveyScore_Dilution(
  questions: Question[],
  factorsByQid: Record<string, Record<ShapeKey, number>>
): number {
  if (!questions.length) return 0;
  let acc = 0;
  for (const q of questions) {
    const { signal, utilization } = computeQuestionSignal(q, factorsByQid[q.id] ?? ({} as any));
    acc += utilization * signal;
  }
  return acc / questions.length;
}

/** Roll up all questions — prior blend strategy ((1-u)*prior + u*signal) */
export function computeSurveyScore_PriorBlend(
  questions: Question[],
  factorsByQid: Record<string, Record<ShapeKey, number>>
): number {
  if (!questions.length) return 0;
  let acc = 0;
  for (const q of questions) {
    const { signal, utilization } = computeQuestionSignal(q, factorsByQid[q.id] ?? ({} as any));
    const prior = questionPriorMean(q);
    const blended = (1 - utilization) * prior + utilization * signal;
    acc += blended;
  }
  return acc / questions.length;
}
