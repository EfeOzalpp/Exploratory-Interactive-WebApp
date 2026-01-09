// canvas-engine/modifiers/color-modifiers/effects.ts

import type { RGB } from "./types.ts";
import { clamp01 } from "./math.ts";
import { hslToRgb, linToSrgb, rgbToHsl, srgbToLin } from "./colorspace.ts";

export function oscillateSaturation(
  base: RGB,
  timeSec: number,
  { amp = 0.15, speed = 0.25, phase = 0 }: { amp?: number; speed?: number; phase?: number } = {}
): RGB {
  const { h, s, l } = rgbToHsl(base);
  const k = clamp01(amp);
  const w = speed * 2 * Math.PI;
  const s2 = clamp01(s * (1 + k * Math.sin(w * timeSec + phase)));
  return hslToRgb({ h, s: s2, l });
}

export function clampSaturation(base: RGB, minS: number, maxS: number, t = 1): RGB {
  const { h, s, l } = rgbToHsl(base);
  const targetS = Math.min(maxS, Math.max(minS, s));
  const lerpedS = s + (targetS - s) * clamp01(t);
  return hslToRgb({ h, s: lerpedS, l });
}

export function oscillateBrightness(
  base: RGB,
  timeSec: number,
  { amp = 0.15, speed = 0.25, phase = 0 }: { amp?: number; speed?: number; phase?: number } = {}
): RGB {
  const { h, s, l } = rgbToHsl(base);
  const k = clamp01(amp);
  const w = speed * 2 * Math.PI;
  const l2 = clamp01(l * (1 + k * Math.sin(w * timeSec + phase)));
  return hslToRgb({ h, s, l: l2 });
}

export function clampBrightness(base: RGB, minL: number, maxL: number, t = 1): RGB {
  const { h, s, l } = rgbToHsl(base);
  const targetL = Math.min(maxL, Math.max(minL, l));
  const lerpedL = l + (targetL - l) * clamp01(t);
  return hslToRgb({ h, s, l: lerpedL });
}

export function driveSaturation(base: RGB, t: number, s0: number, s1: number): RGB {
  const { h, l } = rgbToHsl(base);
  const sTarget = clamp01(s0 + (s1 - s0) * clamp01(t));
  return hslToRgb({ h, s: sTarget, l });
}

export function driveBrightness(base: RGB, t: number, l0: number, l1: number): RGB {
  const { h, s } = rgbToHsl(base);
  const lTarget = clamp01(l0 + (l1 - l0) * clamp01(t));
  return hslToRgb({ h, s, l: lTarget });
}

/** Simple perceptual exposure / contrast adjustment (in linear space) */
export function applyExposureContrast(base: RGB, exposure = 1.0, contrast = 1.0): RGB {
  const e = Math.max(0.01, Math.min(5, exposure));
  const c = Math.max(0.0, Math.min(3, contrast));

  const lin = {
    r: srgbToLin(base.r),
    g: srgbToLin(base.g),
    b: srgbToLin(base.b),
  };

  return {
    r: linToSrgb(Math.pow(lin.r * e, c)),
    g: linToSrgb(Math.pow(lin.g * e, c)),
    b: linToSrgb(Math.pow(lin.b * e, c)),
  };
}
