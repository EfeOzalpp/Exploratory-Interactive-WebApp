// src/canvas/utils/avgToStyle.ts
import { gradientColor } from '../color-modifiers/colorUtils.ts';
import { BRAND_STOPS_VIVID } from '../color-modifiers/colorStops.ts';

export function computeVisualStyle(avg: number) {
  const t = Math.max(0, Math.min(1, avg));

  const { rgb: baseRGB } = gradientColor(BRAND_STOPS_VIVID, t);

  // exposure / contrast only
  const exposure = 1.0 + 0.4 * t;
  const contrast = 0.9 + 0.3 * t;

  const adjustedRGB = applyExposureContrast(baseRGB, exposure, contrast);

  return {
    rgb: adjustedRGB,
    alpha: 255,
    blend: 1.0,
    hueShift: 0,
    brightness: 1,
  };
}

function applyExposureContrast(base, exposure, contrast) {
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const scale = (v: number) =>
    Math.pow(v / 255, Math.max(0, contrast)) * Math.max(0, exposure);
  return {
    r: clamp(scale(base.r) * 255),
    g: clamp(scale(base.g) * 255),
    b: clamp(scale(base.b) * 255),
  };
}
