// utils/saveUserResponse.ts
import { liveClient } from './sanityClient';

type Weights = { q1?: number; q2?: number; q3?: number; q4?: number; q5?: number };

const clamp01 = (v?: number) =>
  typeof v === 'number' ? Math.max(0, Math.min(1, v)) : undefined;

const round3 = (v?: number) =>
  typeof v === 'number' ? Math.round(v * 1000) / 1000 : undefined;

const computeAvg = (w: Weights) => {
  const vals = [w.q1, w.q2, w.q3, w.q4, w.q5].filter(
    (x): x is number => Number.isFinite(x)
  );
  if (!vals.length) return undefined;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return avg;
};

/**
 * Saves a V3 response with numeric q1..q5 (0..1, rounded to 3 decimals)
 * and avgWeight (0..1, rounded to 3 decimals).
 */
export async function saveUserResponse(section: string, weights: Weights) {
  // clamp + round each weight
  const clamped: Weights = {
    q1: round3(clamp01(weights.q1)),
    q2: round3(clamp01(weights.q2)),
    q3: round3(clamp01(weights.q3)),
    q4: round3(clamp01(weights.q4)),
    q5: round3(clamp01(weights.q5)),
  };

  // compute + round avg
  const avgRaw = computeAvg(clamped);
  const avgWeight = round3(avgRaw);

  const doc: any = {
    _type: 'userResponseV3',
    section,
    ...clamped,                // q1..q5
    ...(typeof avgWeight === 'number' ? { avgWeight } : {}), // ensure it’s saved
    submittedAt: new Date().toISOString(),
  };

  const created = await liveClient.create(doc);

  if (typeof window !== 'undefined') {
    sessionStorage.setItem('gp.myEntryId', created._id);
    sessionStorage.setItem('gp.mySection', section);
  }

  return created;
}
