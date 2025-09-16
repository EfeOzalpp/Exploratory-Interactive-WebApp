// =============================================
// utils/hooks.ts
// Centralized gradient + interpolation helpers used across components
// =============================================
import { useMemo } from 'react';

export type RGB = { r: number; g: number; b: number };
export type Stop = { stop: number; color: RGB };

// Default brand gradient (same stops you used)
export const BRAND_STOPS: Stop[] = [
  { stop: 0.0,  color: { r: 249, g: 14,  b: 33 } },
  { stop: 0.46, color: { r: 252, g: 159, b: 29 } },
  { stop: 0.64, color: { r: 245, g: 252, b: 95 } },
  { stop: 0.8,  color: { r: 0,   g: 253, b: 156 } },
  { stop: 1.0,  color: { r: 1,   g: 238, b: 0 } },
];

/** Clamp a number to [min,max] */
export const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

/** Cubic-bezier curve sampler. Same control points you used in components. */
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

/**
 * Sample a multi-stop gradient.
 * @param t - normalized 0..1 position
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

/**
 * Convenience: returns an rgb() string for a given 0..1 t
 */
export const sampleStopsCss = (t: number, stops: Stop[] = BRAND_STOPS) => rgbString(sampleStops(t, stops));

/**
 * Map a percentage 0..100 with optional bezier skew into the gradient.
 * @param pct 0..100
 * @param opts.skew - if provided, apply cubic-bezier skew (p0,p1,p2,p3 are the bezier control points)
 * @param opts.flip - if true, invert t like your DotGraph does (1 - t)
 * @returns RGB + rgb string
 */
export const colorFromPercent = (
  pct: number,
  opts?: { skew?: [number, number, number, number]; flip?: boolean; stops?: Stop[] }
) => {
  const stops = opts?.stops ?? BRAND_STOPS;
  const t0 = clamp(pct / 100);
  const tSkew = opts?.skew ? cubicBezier(t0, ...opts.skew) : t0;
  const tFinal = opts?.flip ? 1 - tSkew : tSkew;
  const rgb = sampleStops(tFinal, stops);
  return { rgb, css: rgbString(rgb), t: tFinal };
};

export type UseGradientOpts = {
  skew?: [number, number, number, number];
  flip?: boolean;
  stops?: Stop[];
};

/**
 * useGradientColor
 * - Input: percent (0..100) or normalized value (0..1 via {normalized:true})
 * - Options: flip (1-t), skew via cubic-bezier, custom stops
 * - Output: { css, rgb, t }
 */
export const useGradientColor = (
  value: number,
  opts?: UseGradientOpts & { normalized?: boolean }
) => {
  return useMemo(() => {
    const pct = opts?.normalized ? clamp(value) * 100 : value;
    return colorFromPercent(pct, { skew: opts?.skew, flip: opts?.flip, stops: opts?.stops });
  }, [value, opts?.normalized, opts?.skew?.[0], opts?.skew?.[1], opts?.skew?.[2], opts?.skew?.[3], opts?.flip, opts?.stops]);
};

/**
 * useGradientForAverageWeight
 * - Helper for DotGraph: consumes an averageWeight in 0..1 and returns color.
 * - Matches your DotGraph's "flipped" mapping and no skew.
 */
export const useGradientForAverageWeight = (avg: number) =>
  useGradientColor(avg, { normalized: true, flip: true });

/**
 * useSkewedPercentColor
 * - Matches Gamification* components: skew curve (0,0.6,0.85,1) and no flip.
 */
export const useSkewedPercentColor = (pct: number) =>
  useGradientColor(pct, { skew: [0, 0.6, 0.85, 1] });

// hooks/useBucketForPercent.ts (share bucket math + caching keys)
export const bucketForPercent = (pct: number) => (
  pct <= 20 ? '0-20' :
  pct <= 40 ? '21-40' :
  pct <= 60 ? '41-60' :
  pct <= 80 ? '61-80' : '81-100'
);

export const storageKeyFor = (prefix: string, id: string, pct: number, version = 'v1') => (
  `${prefix}:${version}:${id}:${bucketForPercent(pct)}`
);

// hooks/useSessionCache.ts – tiny typed sessionStorage wrapper used by both Gamification components
export const safeSession = {
  get<T>(key: string, fallback: T): T {
    try { const raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; }
    catch { return fallback; }
  },
  set<T>(key: string, val: T) {
    try { sessionStorage.setItem(key, JSON.stringify(val)); } catch {}
  }
};

