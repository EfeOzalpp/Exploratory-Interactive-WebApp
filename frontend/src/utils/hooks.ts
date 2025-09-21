// =============================================
// utils/hooks.ts
// Centralized gradient + interpolation helpers used across components
// =============================================
import { useMemo } from 'react';

export type RGB = { r: number; g: number; b: number };
export type Stop = { stop: number; color: RGB };

/** Clamp a number to [min,max] */
export const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

/** Cubic-bezier curve sampler. */
export const cubicBezier = (t: number, p0: number, p1: number, p2: number, p3: number) => {
  const c = 1 - t, c2 = c * c, c3 = c2 * c;
  const t2 = t * t, t3 = t2 * t;
  return (c3 * p0) + (3 * c2 * t * p1) + (3 * c * t2 * p2) + (t3 * p3);
};

/** Interpolate two RGB colors */
export const lerpColor = (t: number, c1: RGB, c2: RGB): RGB => ({
  r: Math.round(c1.r + (c2.r - c1.r) * t),
  g: Math.round(c1.g + (c2.g - c1.g) * t),
  b: Math.round(c1.b + (c2.b - c1.b) * t),
});

/** Convert RGB object to css rgb() string */
export const rgbString = (c: RGB) => `rgb(${c.r}, ${c.g}, ${c.b})`;

// ---------------- Palettes ----------------

// Original brand gradient (0 → red, 1 → green)
export const BRAND_STOPS_ORIGINAL: Stop[] = [
  { stop: 0.0,  color: { r: 249, g: 14,  b: 33 } },
  { stop: 0.46, color: { r: 252, g: 159, b: 29 } },
  { stop: 0.64, color: { r: 245, g: 252, b: 95 } },
  { stop: 0.8,  color: { r: 0,   g: 253, b: 156 } },
  { stop: 1.0,  color: { r: 1,   g: 238, b: 0 } },
];

// VIVID brand gradient (narrow yellow, deeper endpoints)
export const BRAND_STOPS_VIVID: Stop[] = [
  { stop: 0.00, color: { r: 210, g:  0,  b:  25 } },  // deeper, pure red
  { stop: 0.20, color: { r: 255, g:  90, b:   0 } },  // hot orange

  // middle ridge — narrow but bright
  { stop: 0.46, color: { r: 255, g: 210, b:  40 } },  // golden yellow
  { stop: 0.52, color: { r: 255, g: 245, b: 120 } },  // sharp lemon peak
  { stop: 0.58, color: { r: 150, g: 235, b: 120 } },  // bright yellow-green

  { stop: 0.78, color: { r:   0, g: 175, b:  70 } },  // clean green
  { stop: 1.00, color: { r:   0, g: 120, b:  40 } },  // deep forest green
];

// COOL alt (less yellow overall)
export const BRAND_STOPS_COOL: Stop[] = [
  { stop: 0.00, color: { r: 235, g:  28, b:  36 } },
  { stop: 0.40, color: { r: 255, g: 160, b:  40 } },
  { stop: 0.60, color: { r: 120, g: 200, b: 200 } }, // aqua
  { stop: 0.80, color: { r:  70, g: 190, b: 120 } },
  { stop: 1.00, color: { r:   0, g: 170, b:  60 } },
];

// Set the default palette used by helpers.
// Swap this alias to BRAND_STOPS_ORIGINAL if you want the old look globally.
export const BRAND_STOPS: Stop[] = BRAND_STOPS_VIVID;

// --------------- Sampling -----------------

/**
 * Sample a multi-stop gradient.
 * @param tRaw - normalized 0..1 position
 * @param stops - gradient stops (sorted by stop)
 */
export const sampleStops = (tRaw: number, stops: Stop[] = BRAND_STOPS): RGB => {
  const t = clamp(tRaw, 0, 1);
  let lower = stops[0], upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].stop && t <= stops[i + 1].stop) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const range = Math.max(upper.stop - lower.stop, 1e-6);
  const localT = (t - lower.stop) / range;
  return lerpColor(localT, lower.color, upper.color);
};

/** Convenience: returns an rgb() string for a given 0..1 t */
export const sampleStopsCss = (t: number, stops: Stop[] = BRAND_STOPS) =>
  rgbString(sampleStops(t, stops));

// --------------- Tone shaping -----------------

// Optional tone shaping to increase contrast / reduce yellow dominance
const applyGamma = (t: number, gamma = 1) => (gamma !== 1 ? Math.pow(t, gamma) : t);
// Simple contrast curve around 0.5; k ~ 0..1.5 subtle; 2+ is strong
const applyContrast = (t: number, k = 0) => (k ? (t - 0.5) * (1 + k) + 0.5 : t);

export type UseGradientOpts = {
  skew?: [number, number, number, number];
  stops?: Stop[];
  gamma?: number;     // >1 darkens mid, <1 brightens mid
  contrast?: number;  // 0..3 recommended; raises separation from 0.5
};

// --------------- Public API -----------------

/**
 * Map a percentage 0..100 (optionally shaped) into the gradient.
 * Mapping: 0% = red, 100% = green. No inversion.
 */
export const colorFromPercent = (
  pct: number,
  opts?: { skew?: [number, number, number, number]; stops?: Stop[]; gamma?: number; contrast?: number }
) => {
  const stops = opts?.stops ?? BRAND_STOPS;
  const t0 = clamp(pct / 100);
  let t = opts?.skew ? cubicBezier(t0, ...opts.skew) : t0;
  t = applyGamma(t, opts?.gamma ?? 1);
  t = clamp(applyContrast(t, opts?.contrast ?? 0), 0, 1);
  const rgb = sampleStops(t, stops);
  return { rgb, css: rgbString(rgb), t };
};

/**
 * useGradientColor
 * - Input: percent (0..100) or normalized value (0..1 via {normalized:true})
 * - Options: skew via cubic-bezier, custom stops, gamma/contrast shaping
 * - Output: { css, rgb, t }
 * Mapping: 0 → red, 1 → green.
 */
export const useGradientColor = (
  value: number,
  opts?: UseGradientOpts & { normalized?: boolean }
) => {
  return useMemo(() => {
    const pct = opts?.normalized ? clamp(value) * 100 : value;
    return colorFromPercent(pct, {
      skew: opts?.skew,
      stops: opts?.stops,
      gamma: opts?.gamma,
      contrast: opts?.contrast,
    });
  }, [
    value,
    opts?.normalized,
    opts?.skew?.[0], opts?.skew?.[1], opts?.skew?.[2], opts?.skew?.[3],
    opts?.stops,
    opts?.gamma,
    opts?.contrast,
  ]);
};

/**
 * useGradientForAverageWeight
 * - Helper for visuals consuming an average weight in 0..1.
 * - Standardized mapping: 0 → red, 1 → green (no flip).
 * - You can pass {stops, gamma, contrast, skew} for fine control.
 */
export const useGradientForAverageWeight = (
  avg: number,
  opts?: Omit<UseGradientOpts, 'normalized'>
) => useGradientColor(avg, { normalized: true, ...opts });

/**
 * useSkewedPercentColor
 * - Matches prior gamified skew curve (0, 0.6, 0.85, 1).
 * - 0% → red, 100% → green.
 */
export const useSkewedPercentColor = (pct: number) =>
  useGradientColor(pct, { skew: [0, 0.6, 0.85, 1] });

// --------------- Buckets & session helpers ---------------

export const bucketForPercent = (pct: number) => (
  pct <= 20 ? '0-20' :
  pct <= 40 ? '21-40' :
  pct <= 60 ? '41-60' :
  pct <= 80 ? '61-80' : '81-100'
);

export const storageKeyFor = (prefix: string, id: string, pct: number, version = 'v1') => (
  `${prefix}:${version}:${id}:${bucketForPercent(pct)}`
);

// tiny typed sessionStorage wrapper used by both Gamification components
export const safeSession = {
  get<T>(key: string, fallback: T): T {
    try { const raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; }
    catch { return fallback; }
  },
  set<T>(key: string, val: T) {
    try { sessionStorage.setItem(key, JSON.stringify(val)); } catch {}
  }
};
