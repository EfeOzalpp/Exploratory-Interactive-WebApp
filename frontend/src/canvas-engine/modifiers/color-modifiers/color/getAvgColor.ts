// canvas-engine/modifiers/color-modifiers/color/getAvgColor.ts
import type { Stop, RGB } from "./colorStops.ts"; 

function clamp01(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function getAvgColor(u: number, stops: Stop[]) {
  const t = clamp01(u);
  const arr = Array.isArray(stops) ? stops : [];

  if (arr.length === 0) {
    const rgb = { r: 180, g: 228, b: 253 };
    return { rgb, css: `rgb(${rgb.r},${rgb.g},${rgb.b})` };
  }

  // normalize + sort
  const norm = arr
    .map((s) => ({
      at: clamp01(Number(s.stop)),
      rgb: s.color as RGB,
    }))
    .filter((s) => Number.isFinite(s.at) && s.rgb && Number.isFinite(s.rgb.r) && Number.isFinite(s.rgb.g) && Number.isFinite(s.rgb.b))
    .sort((a, b) => a.at - b.at);

  if (norm.length === 0) {
    const rgb = { r: 180, g: 228, b: 253 };
    return { rgb, css: `rgb(${rgb.r},${rgb.g},${rgb.b})` };
  }

  if (t <= norm[0].at) {
    const rgb = norm[0].rgb;
    return { rgb, css: `rgb(${rgb.r},${rgb.g},${rgb.b})` };
  }
  if (t >= norm[norm.length - 1].at) {
    const rgb = norm[norm.length - 1].rgb;
    return { rgb, css: `rgb(${rgb.r},${rgb.g},${rgb.b})` };
  }

  // find segment
  let i = 0;
  for (; i < norm.length - 1; i++) {
    if (t >= norm[i].at && t <= norm[i + 1].at) break;
  }

  const a = norm[i];
  const b = norm[i + 1];
  const span = Math.max(1e-6, b.at - a.at);
  const k = (t - a.at) / span;

  const rgb: RGB = {
    r: Math.round(lerp(a.rgb.r, b.rgb.r, k)),
    g: Math.round(lerp(a.rgb.g, b.rgb.g, k)),
    b: Math.round(lerp(a.rgb.b, b.rgb.b, k)),
  };

  return { rgb, css: `rgb(${rgb.r},${rgb.g},${rgb.b})` };
}
