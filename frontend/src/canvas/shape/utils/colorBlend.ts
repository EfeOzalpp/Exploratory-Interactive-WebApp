// src/canvas/shape/utils/colorBlend.ts
import { mixRGB } from '../../color/colorUtils.ts';
import type { RGB } from '../../color/colorStops.ts';

export function blendRGB(base: RGB, gradientRGB?: RGB, blend: number = 0.5): RGB {
  if (!gradientRGB) return base;
  const k = Math.max(0, Math.min(1, blend));
  return mixRGB(base, gradientRGB, k);
}
