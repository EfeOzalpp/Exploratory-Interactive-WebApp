// canvas-engine/modifiers/color-modifiers/style.ts

import { clamp01 } from "./math.ts";
import { gradientColor } from "./gradient.ts";
import { applyExposureContrast } from "./effects.ts";
import { BRAND_STOPS_VIVID } from "./stops.ts";

export type VisualStyle = {
  rgb: { r: number; g: number; b: number };
  alpha: number;
  blend: number;
  hueShift: number;
  brightness: number;
};

export function sampleBrandColor(avg: number) {
  return gradientColor(BRAND_STOPS_VIVID, avg).rgb;
}

export function computeVisualStyle(avg: number): VisualStyle {
  const t = clamp01(avg);
  const baseRGB = sampleBrandColor(t);

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
