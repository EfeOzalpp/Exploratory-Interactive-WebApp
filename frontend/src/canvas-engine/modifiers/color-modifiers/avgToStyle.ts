// modifiers/color-modifiers/avgToStyle.ts
import { applyExposureContrast, gradientColor } from "../color-modifiers/colorUtils.ts";
import { BRAND_STOPS_VIVID } from './color/colorStops.ts';

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

