// canvas-engine/modifiers/color-modifiers/blend.ts

import type { RGB } from "./types.ts";
import { clamp01 } from "./math.ts";
import { mixRGB, mixRGBGamma } from "./colorspace.ts";

/** Existing API: keep linear for backward compatibility */
export function blendRGB(base: RGB, gradientRGB?: RGB, blend: number = 0.5): RGB {
  if (!gradientRGB) return base;
  const k = clamp01(blend);
  return mixRGB(base, gradientRGB, k);
}

/** Gamma-correct mix for nicer gradients & lighting */
export function blendRGBGamma(base: RGB, gradientRGB?: RGB, blend: number = 0.5): RGB {
  if (!gradientRGB) return base;
  const k = clamp01(blend);
  return mixRGBGamma(base, gradientRGB, k);
}

/** Convenience: choose mode via flag (default gamma) */
export function blendRGBSmart(
  base: RGB,
  gradientRGB?: RGB,
  blend: number = 0.5,
  opts?: { gamma?: boolean }
): RGB {
  return (opts?.gamma ?? true)
    ? blendRGBGamma(base, gradientRGB, blend)
    : blendRGB(base, gradientRGB, blend);
}
