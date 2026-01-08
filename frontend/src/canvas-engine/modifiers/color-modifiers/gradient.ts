// canvas-engine/modifiers/color-modifiers/gradient.ts
import type { RGB, Stop } from "./types.ts";
import { clamp01 } from "./math.ts";
import { mixRGB } from "./colorspace.ts";

export function rgbToCss(c: RGB): string {
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

/**
 * Gradient sampler (linear sRGB).
 * This matches legacy getAvgColor() behavior used for tinting.
 */
export function gradientColor(stops: Stop[], tRaw: number): { rgb: RGB; css: string; t: number } {
  const t = clamp01(tRaw);

  if (!Array.isArray(stops) || stops.length === 0) {
    const rgb = { r: 127, g: 127, b: 127 };
    return { rgb, css: rgbToCss(rgb), t };
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const s1 = stops[i];
    const s2 = stops[i + 1];
    if (t >= s1.stop && t <= s2.stop) {
      const span = Math.max(1e-6, s2.stop - s1.stop);
      const lt = (t - s1.stop) / span;
      const rgb = mixRGB(s1.color, s2.color, lt); // linear
      return { rgb, css: rgbToCss(rgb), t };
    }
  }

  const end = t <= stops[0].stop ? stops[0].color : stops[stops.length - 1].color;
  return { rgb: end, css: rgbToCss(end), t };
}
