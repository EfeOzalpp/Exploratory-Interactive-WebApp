// utils/answerBlend.ts

/**
 * Opacity model (stabilized for ghost/preview motion):
 * - If snapped to a checkpoint: only that checkpoint is 1.0.
 * - If between checkpoints i..i+1:
 *    • We keep a soft plateau around the midpoint so both neighbors
 *      sit at 1.0 briefly (reduces flicker when ghost hovers near 0.5).
 *    • Left is held at 1.0 then ramps down after the plateau,
 *      Right ramps up to 1.0 before the plateau then holds.
 * - Non-neighbors are 0.
 */
export function getAnswerOpacities(
  t: number | undefined,
  snappedIndex?: number | null
): number[] {
  const op = [0, 0, 0, 0];

  if (t == null) return op;

  // If the thumb is snapped onto a checkpoint, only that one is fully on.
  if (Number.isInteger(snappedIndex)) {
    op[snappedIndex as number] = 1;
    return op;
  }

  const clamped = Math.max(0, Math.min(3, t));
  const i = Math.floor(clamped);   // left index of the current segment
  const f = clamped - i;           // 0..1 within the segment

  // Rightmost hard end
  if (i >= 3) {
    op[3] = 1;
    return op;
  }

  const left = i;
  const right = i + 1;

  // Soft midpoint plateau to avoid churn at ~0.5 during ghost motion
  const PLATEAU_LOW = 0.45;
  const PLATEAU_HIGH = 0.55;

  let leftOpacity: number;
  let rightOpacity: number;

  if (f <= PLATEAU_LOW) {
    // Left stays full; Right ramps 0 → 1 as f goes 0 → 0.45
    leftOpacity = 1;
    rightOpacity = Math.max(0, Math.min(1, f / PLATEAU_LOW));
  } else if (f >= PLATEAU_HIGH) {
    // Right stays full; Left ramps 1 → 0 as f goes 0.55 → 1
    leftOpacity = Math.max(0, Math.min(1, (1 - f) / (1 - PLATEAU_HIGH)));
    rightOpacity = 1;
  } else {
    // Inside the plateau: both neighbors are full
    leftOpacity = 1;
    rightOpacity = 1;
  }

  op[left] = leftOpacity;
  op[right] = rightOpacity;

  return op;
}

/**
 * Scale activations:
 * - If snapped: only that checkpoint is 1.0.
 * - Otherwise: linear blend across the current segment:
 *     left = 1 - f, right = f
 * - Others: 0.
 * Use these to drive size and stacking (z-index) along with opacity.
 */
export function getScaleActivations(
  t: number | undefined,
  snappedIndex?: number | null
): number[] {
  const act = [0, 0, 0, 0];

  if (t == null) return act;

  if (Number.isInteger(snappedIndex)) {
    act[snappedIndex as number] = 1;
    return act;
  }

  const clamped = Math.max(0, Math.min(3, t));
  const i = Math.floor(clamped);
  const f = clamped - i; // 0..1 within the segment

  act[i] = 1 - f;
  if (i < 3) act[i + 1] = f;

  return act;
}
