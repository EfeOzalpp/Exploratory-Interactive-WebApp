// modifiers/color-modifiers/colorBlend.ts
import { mixRGB, mixRGBGamma } from "./colorUtils.ts";
import type { RGB } from "./color/colorStops.ts";

/** Existing API: keep linear for backward compatibility */
export function blendRGB(base: RGB, gradientRGB?: RGB, blend: number = 0.5): RGB {
  if (!gradientRGB) return base;
  const k = Math.max(0, Math.min(1, blend));
  return mixRGB(base, gradientRGB, k);
}

/** Gamma-correct mix for nicer gradients & lighting */
export function blendRGBGamma(base: RGB, gradientRGB?: RGB, blend: number = 0.5): RGB {
  if (!gradientRGB) return base;
  const k = Math.max(0, Math.min(1, blend));
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
