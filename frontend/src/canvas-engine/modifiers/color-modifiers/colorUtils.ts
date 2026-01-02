import type { RGB, Stop } from './colorStops';

/* ──────────────────────────────────────────────────────────────────────────
   Core utils
   ────────────────────────────────────────────────────────────────────────── */

export const clamp01 = (v: number | undefined) =>
  typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const lerpRGB = (c1: RGB, c2: RGB, t: number): RGB => ({
  r: Math.round(lerp(c1.r, c2.r, t)),
  g: Math.round(lerp(c1.g, c2.g, t)),
  b: Math.round(lerp(c1.b, c2.b, t)),
});

/* ──────────────────────────────────────────────────────────────────────────
   Gamma-correct blending (sRGB <-> linear)
   ────────────────────────────────────────────────────────────────────────── */

const srgbToLin = (u: number) => {
  const x = u / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};

const linToSrgb = (u: number) => {
  const y = u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, y)) * 255);
};

/** Gamma-correct RGB mix: linearize → lerp → encode */
export function mixRGBGamma(a: RGB, b: RGB, t: number): RGB {
  const k = Math.max(0, Math.min(1, t));
  const A = [srgbToLin(a.r), srgbToLin(a.g), srgbToLin(a.b)];
  const B = [srgbToLin(b.r), srgbToLin(b.g), srgbToLin(b.b)];
  const L = [
    A[0] + (B[0] - A[0]) * k,
    A[1] + (B[1] - A[1]) * k,
    A[2] + (B[2] - A[2]) * k,
  ];
  return { r: linToSrgb(L[0]), g: linToSrgb(L[1]), b: linToSrgb(L[2]) };
}

/* ──────────────────────────────────────────────────────────────────────────
   Gradient sampling — now gamma-correct by default
   ────────────────────────────────────────────────────────────────────────── */

export function gradientColor(stops: Stop[], tRaw: number) {
  const t = clamp01(tRaw);
  if (!stops?.length) {
    const rgb = { r: 127, g: 127, b: 127 };
    return { rgb, css: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, t };
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const s1 = stops[i], s2 = stops[i + 1];
    if (t >= s1.stop && t <= s2.stop) {
      const lt = (t - s1.stop) / (s2.stop - s1.stop);
      // switched to gamma-correct mixing
      const rgb = mixRGBGamma(s1.color, s2.color, lt);
      return { rgb, css: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, t };
    }
  }

  const end = t <= stops[0].stop ? stops[0].color : stops[stops.length - 1].color;
  return { rgb: end, css: `rgb(${end.r}, ${end.g}, ${end.b})`, t };
}

export const rgbToCss = (c: RGB) => `rgb(${c.r}, ${c.g}, ${c.b})`;

/** Linear (non-gamma) blend kept for compatibility */
export function mixRGB(a: RGB, b: RGB, k: number): RGB {
  const kk = Math.max(0, Math.min(1, k));
  return {
    r: Math.round(a.r + (b.r - a.r) * kk),
    g: Math.round(a.g + (b.g - a.g) * kk),
    b: Math.round(a.b + (b.b - a.b) * kk),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   HSL helpers & animation utilities
   ────────────────────────────────────────────────────────────────────────── */

export function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
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
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return { r, g, b };
}

export function oscillateSaturation(
  base: RGB,
  timeSec: number,
  { amp = 0.15, speed = 0.25, phase = 0 }: { amp?: number; speed?: number; phase?: number } = {}
): RGB {
  const { h, s, l } = rgbToHsl(base);
  const k = Math.max(0, Math.min(1, amp));
  const w = speed * 2 * Math.PI;
  const s2 = Math.max(0, Math.min(1, s * (1 + k * Math.sin(w * timeSec + phase))));
  return hslToRgb({ h, s: s2, l });
}

export function clampSaturation(base: RGB, minS: number, maxS: number, t = 1): RGB {
  const { h, s, l } = rgbToHsl(base);
  const targetS = Math.min(maxS, Math.max(minS, s));
  const lerpedS = s + (targetS - s) * Math.max(0, Math.min(1, t));
  return hslToRgb({ h, s: lerpedS, l });
}

export function oscillateBrightness(
  base: RGB,
  timeSec: number,
  { amp = 0.15, speed = 0.25, phase = 0 }: { amp?: number; speed?: number; phase?: number } = {}
): RGB {
  const { h, s, l } = rgbToHsl(base);
  const k = Math.max(0, Math.min(1, amp));
  const w = speed * 2 * Math.PI;
  const l2 = Math.max(0, Math.min(1, l * (1 + k * Math.sin(w * timeSec + phase))));
  return hslToRgb({ h, s, l: l2 });
}

export function clampBrightness(base: RGB, minL: number, maxL: number, t = 1): RGB {
  const { h, s, l } = rgbToHsl(base);
  const targetL = Math.min(maxL, Math.max(minL, l));
  const lerpedL = l + (targetL - l) * Math.max(0, Math.min(1, t));
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
// Simple perceptual exposure / contrast adjustment
export function applyExposureContrast(
  base: RGB,
  exposure: number = 1.0,
  contrast: number = 1.0
): RGB {
  // normalize inputs
  const e = Math.max(0.01, Math.min(5, exposure));
  const c = Math.max(0.0, Math.min(3, contrast));

  // apply exposure in linear space
  const lin = {
    r: srgbToLin(base.r),
    g: srgbToLin(base.g),
    b: srgbToLin(base.b),
  };

  let r = linToSrgb(Math.pow(lin.r * e, c));
  let g = linToSrgb(Math.pow(lin.g * e, c));
  let b = linToSrgb(Math.pow(lin.b * e, c));

  return { r, g, b };
}

