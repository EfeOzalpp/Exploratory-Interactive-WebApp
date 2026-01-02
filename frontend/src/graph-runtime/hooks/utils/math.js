// src/components/dotGraph/utils/math.js
export const lerp = (a, b, t) => a + (b - a) * t;

export const nonlinearLerp = (start, end, t) => {
  const eased = 1 - Math.pow(1 - t, 5);
  return start + (end - start) * eased;
};

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
