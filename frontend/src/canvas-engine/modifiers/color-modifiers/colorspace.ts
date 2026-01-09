// canvas-engine/modifiers/color-modifiers/colorspace.ts

import type { RGB } from "./types.ts";
import { clamp01, lerp } from "./math.ts";

/** sRGB [0..255] -> linear [0..1] */
export function srgbToLin(u8: number): number {
  const x = Math.max(0, Math.min(255, u8)) / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

/** linear [0..1] -> sRGB [0..255] */
export function linToSrgb(u: number): number {
  const y = u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055;
  return Math.round(clamp01(y) * 255);
}

/** Linear (non-gamma) blend kept for compatibility */
export function mixRGB(a: RGB, b: RGB, t: number): RGB {
  const k = clamp01(t);
  return {
    r: Math.round(lerp(a.r, b.r, k)),
    g: Math.round(lerp(a.g, b.g, k)),
    b: Math.round(lerp(a.b, b.b, k)),
  };
}

/** Gamma-correct RGB mix: linearize -> lerp -> encode */
export function mixRGBGamma(a: RGB, b: RGB, t: number): RGB {
  const k = clamp01(t);
  const A = [srgbToLin(a.r), srgbToLin(a.g), srgbToLin(a.b)];
  const B = [srgbToLin(b.r), srgbToLin(b.g), srgbToLin(b.b)];

  return {
    r: linToSrgb(A[0] + (B[0] - A[0]) * k),
    g: linToSrgb(A[1] + (B[1] - A[1]) * k),
    b: linToSrgb(A[2] + (B[2] - A[2]) * k),
  };
}

export function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const R = r / 255, G = g / 255, B = b / 255;

  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    switch (max) {
      case R: h = (G - B) / d + (G < B ? 6 : 0); break;
      case G: h = (B - R) / d + 2; break;
      case B: h = (R - G) / d + 4; break;
    }
    h /= 6;
  }

  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

export function hslToRgb({ h, s, l }: { h: number; s: number; l: number }): RGB {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}
