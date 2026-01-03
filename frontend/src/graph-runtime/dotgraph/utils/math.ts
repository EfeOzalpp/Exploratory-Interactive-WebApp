// src/components/dotGraph/utils/math.
export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

export const nonlinearLerp = (
  start: number,
  end: number,
  t: number
): number => {
  const eased = 1 - Math.pow(1 - t, 5);
  return start + (end - start) * eased;
};

export const clamp = (
  v: number,
  min: number,
  max: number
): number =>
  Math.max(min, Math.min(max, v));
