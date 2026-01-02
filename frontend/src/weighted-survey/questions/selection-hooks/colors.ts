// src/components/survey/questions/SelectionHooks/colors.ts

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const easeFn = (t: number) => t * t * (3 - 2 * t);

const toHex2 = (n: number) => n.toString(16).padStart(2, '0');
const rgbToHex = (r: number, g: number, b: number) => `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;

export const hexToRgb = (hex: string) => {
  const n = hex.replace('#', '');
  const s = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
  const v = parseInt(s, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
};

export const mix = (a: string, b: string, t: number) => {
  const A = hexToRgb(a), B = hexToRgb(b);
  const lerp = (x: number, y: number) => Math.round(x + (y - x) * t);
  return rgbToHex(lerp(A.r, B.r), lerp(A.g, B.g), lerp(A.b, B.b));
};

// Color ramp tuning: keep fully gray near rim; ramp quickly to saturated color.
const COLOR_EDGE0 = 0.06;
const COLOR_EDGE1 = 0.22;
const SAT_BOOST   = 0.6;

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const colorForFactory = (
  OUTER_GRAY: string,
  SHAPE_COLORS: Record<'triangle' | 'circle' | 'square' | 'diamond', string>
) => {
  return (shape: 'triangle' | 'circle' | 'square' | 'diamond', w01: number) => {
    const t0 = smoothstep(COLOR_EDGE0, COLOR_EDGE1, clamp(w01, 0, 1));
    const tBoosted = Math.pow(t0, SAT_BOOST); // <1 = more saturated quickly
    return mix(OUTER_GRAY, SHAPE_COLORS[shape], tBoosted);
  };
};
