// utils/answerBlend.ts

/**
 * New opacity logic:
 * - If snapped: only that checkpoint is 1.
 * - In-between:
 *   - At f = 0.5 (midpoint): BOTH neighbors are 1.0
 *   - For f < 0.5: left stays 1.0, right ramps 0 → 1 as f goes 0 → 0.5
 *   - For f > 0.5: right stays 1.0, left  ramps 1 → 0 as f goes 0.5 → 1
 * - Non-neighbors: 0
 */
export function getAnswerOpacities(t: number | undefined, snappedIndex?: number | null) {
  const op = [0, 0, 0, 0];

  if (t == null) return op;

  if (Number.isInteger(snappedIndex)) {
    op[snappedIndex!] = 1;
    return op;
  }

  const clamped = Math.max(0, Math.min(3, t));
  const i = Math.floor(clamped);      // left index
  const f = clamped - i;              // 0..1 within the segment

  // At hard end (t === 3) just light the last checkpoint
  if (i >= 3) {
    op[3] = 1;
    return op;
  }

  const left  = i;
  const right = i + 1;

  let leftOpacity: number;
  let rightOpacity: number;

  if (f <= 0.5) {
    leftOpacity  = 1;
    rightOpacity = 2 * f;           // 0..1 as f→0.5
  } else {
    leftOpacity  = 2 * (1 - f);     // 1..0 as f→1
    rightOpacity = 1;
  }

  op[left]  = Math.max(0, Math.min(1, leftOpacity));
  op[right] = Math.max(0, Math.min(1, rightOpacity));

  return op;
}

/**
 * Scale activations (unchanged from your original behavior):
 * - If snapped: only that checkpoint is 1.
 * - Otherwise: linear blend: left = 1 - f, right = f.
 * - Non-neighbors: 0.
 * Use these to drive size/scale and stacking (z-index) if desired.
 */
export function getScaleActivations(t: number | undefined, snappedIndex?: number | null) {
  const act = [0, 0, 0, 0];

  if (t == null) return act;

  if (Number.isInteger(snappedIndex)) {
    act[snappedIndex!] = 1;
    return act;
  }

  const clamped = Math.max(0, Math.min(3, t));
  const i = Math.floor(clamped);      // 0..3, last segment ends at 2.x
  const f = clamped - i;              // 0..1 within the segment

  act[i] = 1 - f;

  if (i < 3) act[i + 1] = f;

  return act;
}
